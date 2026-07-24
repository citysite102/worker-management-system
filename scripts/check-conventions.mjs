#!/usr/bin/env node
/**
 * 專案規約檢查（棘輪式 ratchet）。
 *
 * 這支不是通用 linter，而是針對本專案已知的兩個風險做「只能變好、不能變壞」
 * 的把關：
 *
 *   1. 權限：目前 56 個 procedure 全部是 publicProcedure，等於 API 沒有權限保護。
 *      現況先記錄成 baseline，之後 **新增** public procedure 會被擋下來；
 *      把既有的改成 protectedProcedure 則會讓 baseline 自動縮小。
 *
 *   2. 測試覆蓋：記錄目前沒有測試的 procedure 清單，新增沒測試的 procedure 會被擋。
 *
 * 用法：
 *   node scripts/check-conventions.mjs            # 檢查，違規時 exit 1
 *   node scripts/check-conventions.mjs --update   # 把現況寫回 baseline
 *
 * baseline 檔：.harness/conventions-baseline.json（請一併 commit）
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ROUTERS_FILE = path.join(ROOT, "server", "routers.ts");
const BASELINE_FILE = path.join(ROOT, ".harness", "conventions-baseline.json");
const UPDATE = process.argv.includes("--update");

// ─── 解析 routers.ts，取出所有 procedure 的完整路徑與型別 ────────────────────

/** @returns {{path: string, kind: "public"|"protected", line: number}[]} */
function parseProcedures(source) {
  const lines = source.split("\n");
  /** @type {{indent: number, name: string}[]} */
  const stack = [];
  const procedures = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const routerMatch = line.match(/^(\s*)(\w+):\s*router\(\{/);
    if (routerMatch) {
      const indent = routerMatch[1].length;
      while (stack.length && stack[stack.length - 1].indent >= indent)
        stack.pop();
      stack.push({ indent, name: routerMatch[2] });
      continue;
    }

    const procMatch = line.match(
      /^(\s*)(\w+):\s*(publicProcedure|protectedProcedure)\b/
    );
    if (procMatch) {
      const indent = procMatch[1].length;
      while (stack.length && stack[stack.length - 1].indent >= indent)
        stack.pop();
      procedures.push({
        path: [...stack.map(s => s.name), procMatch[2]].join("."),
        kind: procMatch[3] === "protectedProcedure" ? "protected" : "public",
        line: i + 1,
      });
    }
  }

  return procedures;
}

/**
 * 解析 routers.ts 及被掛載進 appRouter 的 per-domain 子路由檔（server/routers/*.ts），
 * 讓拆檔後 procedure 仍被規約看見（路徑維持 <mount>.<proc>，如 auth.login）。
 * 沒拆檔時退化為只解析 routers.ts，行為不變。
 */
function parseAllProcedures() {
  const rootSrc = readFileSync(ROUTERS_FILE, "utf8");
  const procs = parseProcedures(rootSrc);

  // import { xRouter } from "./routers/<file>"
  const importMap = new Map();
  for (const m of rootSrc.matchAll(
    /import\s*\{\s*(\w+)\s*\}\s*from\s*["']\.\/(routers\/[^"']+)["']/g
  )) {
    importMap.set(m[1], path.join(ROOT, "server", m[2] + ".ts"));
  }
  // 掛載點：`  <mount>: <xRouter>,`（頂層 2 空格縮排、變數名以 Router 結尾）
  for (const m of rootSrc.matchAll(/^ {2}(\w+):\s*(\w+Router),?\s*$/gm)) {
    const [, mount, varName] = m;
    const file = importMap.get(varName);
    if (!file || !existsSync(file)) continue;
    for (const p of parseProcedures(readFileSync(file, "utf8"))) {
      procs.push({ ...p, path: `${mount}.${p.path}` });
    }
  }
  return procs;
}

// ─── 掃描測試檔，找出被呼叫過的 procedure 路徑 ──────────────────────────────

function collectFiles(dir, predicate, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

function findTestedProcedures() {
  const testFiles = [
    ...collectFiles(path.join(ROOT, "server"), f =>
      /\.(test|spec)\.ts$/.test(f)
    ),
    ...collectFiles(path.join(ROOT, "e2e"), f => /\.spec\.ts$/.test(f)),
  ];

  const tested = new Set();
  for (const file of testFiles) {
    const source = readFileSync(file, "utf8");
    // 比對 caller.a.b(...) / caller.a.b.c(...) 這類呼叫
    for (const match of source.matchAll(/\bcaller\.((?:\w+\.)*\w+)\s*\(/g)) {
      tested.add(match[1]);
    }
  }
  return tested;
}

// ─── 對外資料出口守則：禁止在 publicView 以外對「蓋章型別」強制轉型 ──────────────
// 對外資料一律經 server/publicView.ts 的 toPublicX 蓋章產出；其餘檔案若用
// `as Public*` 強制轉型，等於繞過去識別遮蔽——直接擋下（非棘輪，應永遠為 0）。

const PUBLIC_VIEW_REL = path.join("server", "publicView.ts");
const BRAND_CAST =
  /\bas\s+(?:Public<|PublicProfile\b|PublicWorkerCard\b|PublicListingCard\b|PublicListingDetail\b)/;

function findIllegalPublicCasts() {
  const files = [
    ...collectFiles(path.join(ROOT, "server"), f => /\.tsx?$/.test(f)),
    ...collectFiles(path.join(ROOT, "shared"), f => /\.tsx?$/.test(f)),
    ...collectFiles(path.join(ROOT, "client"), f => /\.tsx?$/.test(f)),
  ];
  const violations = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (rel === PUBLIC_VIEW_REL) continue; // 唯一允許蓋章之處
    if (/\.(test|spec)\.tsx?$/.test(rel)) continue; // 測試可自由建構假資料
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (BRAND_CAST.test(lines[i])) violations.push(`${rel}:${i + 1}`);
    }
  }
  return violations;
}

// ─── 主流程 ────────────────────────────────────────────────────────────────

const procedures = parseAllProcedures();

if (procedures.length === 0) {
  console.error(
    "✖ 無法從 server/routers.ts 解析出任何 procedure —— 解析器可能需要更新。"
  );
  process.exit(1);
}

const tested = findTestedProcedures();
const current = {
  publicProcedures: procedures
    .filter(p => p.kind === "public")
    .map(p => p.path)
    .sort(),
  untestedProcedures: procedures
    .filter(p => !tested.has(p.path))
    .map(p => p.path)
    .sort(),
};

if (UPDATE) {
  mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  writeFileSync(
    BASELINE_FILE,
    JSON.stringify(
      {
        _comment:
          "由 scripts/check-conventions.mjs --update 產生。清單只能縮小，不能變長；" +
          "縮小後請重跑 --update 把 baseline 收緊，避免退步空間被保留。",
        ...current,
      },
      null,
      2
    ) + "\n"
  );
  console.log(
    `✓ baseline 已更新：${current.publicProcedures.length} 個 public、` +
      `${current.untestedProcedures.length} 個未測試`
  );
  process.exit(0);
}

if (!existsSync(BASELINE_FILE)) {
  console.error(`✖ 找不到 baseline：${path.relative(ROOT, BASELINE_FILE)}`);
  console.error("  請先執行：node scripts/check-conventions.mjs --update");
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
const problems = [];

const newPublic = current.publicProcedures.filter(
  p => !(baseline.publicProcedures ?? []).includes(p)
);
if (newPublic.length > 0) {
  problems.push(
    `新增了 ${newPublic.length} 個未受保護的 publicProcedure：\n` +
      newPublic.map(p => `    - ${p}`).join("\n") +
      `\n  新的 procedure 請用 protectedProcedure。` +
      `\n  若這支確實必須公開（例如 auth.me），執行 --update 把它納入 baseline。`
  );
}

const newUntested = current.untestedProcedures.filter(
  p => !(baseline.untestedProcedures ?? []).includes(p)
);
if (newUntested.length > 0) {
  problems.push(
    `新增了 ${newUntested.length} 個沒有測試的 procedure：\n` +
      newUntested.map(p => `    - ${p}`).join("\n") +
      `\n  請在 server/*.test.ts 或 server/*.integration.test.ts 補上呼叫。`
  );
}

const illegalCasts = findIllegalPublicCasts();
if (illegalCasts.length > 0) {
  problems.push(
    `發現 ${illegalCasts.length} 處在 server/publicView.ts 以外對「蓋章型別」強制轉型：\n` +
      illegalCasts.map(v => `    - ${v}`).join("\n") +
      `\n  對外資料一律經 server/publicView.ts 的 toPublicX 產出；請勿用 as Public* 繞過遮蔽。`
  );
}

// 棘輪收緊提醒：清單變短是好事，提醒把 baseline 一起收緊。
const fixedPublic =
  (baseline.publicProcedures ?? []).length - current.publicProcedures.length;
const fixedTests =
  (baseline.untestedProcedures ?? []).length -
  current.untestedProcedures.length;

if (problems.length > 0) {
  console.error("✖ 專案規約檢查未通過\n");
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}

console.log(
  `✓ 專案規約檢查通過（${procedures.length} 個 procedure，` +
    `${current.publicProcedures.length} 個 public、${current.untestedProcedures.length} 個未測試）`
);
if (fixedPublic > 0 || fixedTests > 0) {
  console.log(
    `  ↑ 比 baseline 進步了：public -${fixedPublic}、未測試 -${fixedTests}。` +
      `\n    請執行 node scripts/check-conventions.mjs --update 收緊 baseline。`
  );
}

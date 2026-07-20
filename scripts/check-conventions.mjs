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

// ─── 主流程 ────────────────────────────────────────────────────────────────

const source = readFileSync(ROUTERS_FILE, "utf8");
const procedures = parseProcedures(source);

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

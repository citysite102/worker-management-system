/**
 * 建立 / 重置整合測試用的資料庫（wms_test）。
 *
 *   node scripts/setup-test-db.mjs
 *
 * 流程：
 *   1. 連到 MySQL server（不指定 database）
 *   2. DROP + CREATE DATABASE wms_test
 *   3. 用 drizzle-kit push 把 drizzle/schema.ts 同步進去
 *
 * 測試連線字串由 TEST_DATABASE_URL 決定，未設定時預設走本地 Docker 容器
 * （見 README.dev.md 的 wms-mysql 容器）。
 */
import { execFileSync } from "node:child_process";
import mysql from "mysql2/promise";
import "dotenv/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "mysql://root:root@localhost:3306/wms_test";

const url = new URL(TEST_DATABASE_URL);
const dbName = url.pathname.replace(/^\//, "");

if (!dbName) {
  throw new Error(`TEST_DATABASE_URL 缺少 database 名稱：${TEST_DATABASE_URL}`);
}

// 安全閥：本腳本會 DROP 整個 database，因此名稱必須明確標示為測試用途。
// 這是為了避免手滑把開發用的 wms（或線上資料庫）整個洗掉。
if (!/(test|e2e)/i.test(dbName)) {
  throw new Error(
    `拒絕操作：資料庫名稱必須包含 "test" 或 "e2e"，目前是 "${dbName}"。\n` +
      `這道檢查是為了避免誤刪開發或正式資料庫。`
  );
}

const adminUrl = new URL(TEST_DATABASE_URL);
adminUrl.pathname = "/";

console.log(`[test-db] 重建資料庫 ${dbName} ...`);

const conn = await mysql.createConnection({
  host: adminUrl.hostname,
  port: Number(adminUrl.port || 3306),
  user: decodeURIComponent(adminUrl.username),
  password: decodeURIComponent(adminUrl.password),
  multipleStatements: true,
});

await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
await conn.query(
  `CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
await conn.end();

console.log(`[test-db] 套用 schema（drizzle-kit push）...`);

execFileSync("pnpm", ["exec", "drizzle-kit", "push", "--force"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
});

console.log(`[test-db] 完成：${TEST_DATABASE_URL}`);

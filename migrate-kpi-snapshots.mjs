import { createConnection } from "mysql2/promise";
import "dotenv/config";

// 從環境變數取連線字串（本地由 dotenv 從 .env 載入；Manus 是平台直接注入，
// 那裡沒有 .env 檔案）。原本這支直接 readFileSync(".env")，導致它在
// Manus 上物理上跑不起來 —— kpi_snapshots 因此從未在線上被建立，
// 儀表板每次載入都在查一張不存在的表。
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 未設定");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

const statements = [
  `CREATE TABLE IF NOT EXISTS kpi_snapshots (
    snapshotDate VARCHAR(10) NOT NULL,
    workers INT NOT NULL DEFAULT 0,
    customers INT NOT NULL DEFAULT 0,
    cases INT NOT NULL DEFAULT 0,
    employed INT NOT NULL DEFAULT 0,
    expiringSoon INT NOT NULL DEFAULT 0,
    expired INT NOT NULL DEFAULT 0,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (snapshotDate)
  )`,
];

let success = 0;
for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("✅ Executed:", sql.split("\n")[0]);
    success++;
  } catch (err) {
    console.error("❌ Failed:", err.code ?? err.message);
  }
}

console.log(`\nDone. ${success}/${statements.length} statement(s) executed.`);
await conn.end();

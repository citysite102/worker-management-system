import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf-8");
const dbUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim().replace(/^["']|["']$/g, "");

if (!dbUrl) {
  console.error("DATABASE_URL not found in .env");
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

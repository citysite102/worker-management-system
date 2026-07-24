/**
 * 遷移腳本（idempotent）：需求單擴充 P1 職缺欄位（見 docs/feature-demand-form-p1.md）。
 *   - case_demands 新增：district / employmentType / salaryMin / salaryMax /
 *     expectedStartDate / actualExpectedStartDate / requirements /
 *     publicDescription / notesForSeeker / notesForApplicant
 *   - customers 新增：publicDisplayName（對外匿名代稱）
 *
 * 皆為 nullable additive，安全；部署順序：先跑本腳本再上程式碼。
 * 用法：node -r dotenv/config scripts/migrate-demand-form-p1.mjs
 */
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function columnExists(table, column) {
  const [rows] = await conn.execute(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumns(table, additions) {
  for (const [col, ddl] of additions) {
    if (await columnExists(table, col)) {
      console.log(`· ${table}.${col} 已存在，略過`);
    } else {
      await conn.execute(`ALTER TABLE \`${table}\` ${ddl}`);
      console.log(`✓ ${table}.${col} 已新增`);
    }
  }
}

console.log("→ case_demands 新增職缺欄位…");
await addColumns("case_demands", [
  ["district", "ADD COLUMN `district` varchar(30)"],
  [
    "employmentType",
    "ADD COLUMN `employmentType` enum('live_in','live_out','institution','other')",
  ],
  ["salaryMin", "ADD COLUMN `salaryMin` int"],
  ["salaryMax", "ADD COLUMN `salaryMax` int"],
  ["expectedStartDate", "ADD COLUMN `expectedStartDate` varchar(10)"],
  [
    "actualExpectedStartDate",
    "ADD COLUMN `actualExpectedStartDate` varchar(10)",
  ],
  ["requirements", "ADD COLUMN `requirements` text"],
  ["publicDescription", "ADD COLUMN `publicDescription` text"],
  ["notesForSeeker", "ADD COLUMN `notesForSeeker` text"],
  ["notesForApplicant", "ADD COLUMN `notesForApplicant` text"],
]);

console.log("→ customers 新增對外顯示名稱…");
await addColumns("customers", [
  ["publicDisplayName", "ADD COLUMN `publicDisplayName` varchar(100)"],
]);

console.log("✓ 完成（需求單 P1 職缺欄位）");
await conn.end();

import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await createConnection(url);

const alterStatements = [
  // 聘僱時間
  "ALTER TABLE `cases` ADD COLUMN `continuousEmploymentDate` varchar(10) NULL",
  "ALTER TABLE `cases` ADD COLUMN `employmentPeriodMonths` int NULL",
  "ALTER TABLE `cases` ADD COLUMN `terminationDate` varchar(10) NULL",
  // 代辦事項
  "ALTER TABLE `cases` ADD COLUMN `recruitmentAgencyItems` enum('none','self','agency') NULL",
  "ALTER TABLE `cases` ADD COLUMN `employmentAgencyItems` enum('none','self','agency') NULL",
  "ALTER TABLE `cases` ADD COLUMN `postEmploymentInsurance` enum('none','health','accident','both') NULL",
  // 聘僱許可函與情況
  "ALTER TABLE `cases` ADD COLUMN `employmentPermitFileKey` varchar(300) NULL",
  "ALTER TABLE `cases` ADD COLUMN `employmentStatus` enum('normal','suspended','terminated','transferred') NULL",
  "ALTER TABLE `cases` ADD COLUMN `terminationLetterFileKey` varchar(300) NULL",
];

let success = 0;
let skipped = 0;

for (const sql of alterStatements) {
  try {
    await conn.execute(sql);
    console.log("✓", sql.split("`")[3]);
    success++;
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("⚠ already exists:", sql.split("`")[3]);
      skipped++;
    } else {
      console.error("✗ FAILED:", sql);
      console.error("  Error:", err.message);
    }
  }
}

await conn.end();
console.log(`\nDone: ${success} added, ${skipped} skipped`);

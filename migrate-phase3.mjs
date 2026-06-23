import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection(url);

const columns = [
  // 承接通報/入國通報
  "ALTER TABLE `cases` ADD COLUMN `notificationNo` VARCHAR(50) NULL",
  "ALTER TABLE `cases` ADD COLUMN `entryNotificationDate` VARCHAR(10) NULL",
  "ALTER TABLE `cases` ADD COLUMN `certificateNo` VARCHAR(50) NULL",
  // 內政部移民署
  "ALTER TABLE `cases` ADD COLUMN `niaCategory` VARCHAR(50) NULL",
  "ALTER TABLE `cases` ADD COLUMN `niaNo` VARCHAR(50) NULL",
  "ALTER TABLE `cases` ADD COLUMN `residencePermitSubmitDate` VARCHAR(10) NULL",
  // 勞動部聘僱許可函
  "ALTER TABLE `cases` ADD COLUMN `molReceiptNo` VARCHAR(50) NULL",
  "ALTER TABLE `cases` ADD COLUMN `employmentLetterCategory` VARCHAR(50) NULL",
  "ALTER TABLE `cases` ADD COLUMN `applicationSubmitDate` VARCHAR(10) NULL",
  "ALTER TABLE `cases` ADD COLUMN `issuanceDate` VARCHAR(10) NULL",
  "ALTER TABLE `cases` ADD COLUMN `approvalReceiptDate` VARCHAR(10) NULL",
];

let success = 0;
let skipped = 0;
for (const sql of columns) {
  try {
    await conn.execute(sql);
    const col = sql.match(/ADD COLUMN `(\w+)`/)?.[1];
    console.log(`✅ Added: ${col}`);
    success++;
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      const col = sql.match(/ADD COLUMN `(\w+)`/)?.[1];
      console.log(`⏭  Already exists: ${col}`);
      skipped++;
    } else {
      console.error(`❌ Error: ${err.message}`);
      console.error(`   SQL: ${sql}`);
    }
  }
}

await conn.end();
console.log(`\nDone: ${success} added, ${skipped} already existed`);

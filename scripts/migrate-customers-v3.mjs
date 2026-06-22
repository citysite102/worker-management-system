/**
 * 客戶管理 v3.0 遷移腳本
 * 為 customers 表新增雙類型雇主所需的所有欄位
 */
import { createConnection } from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Parse mysql://user:pass@host:port/db?ssl=...
const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
if (!match) {
  console.error("Cannot parse DATABASE_URL:", url.substring(0, 30));
  process.exit(1);
}
const [, user, password, host, port, database] = match;

const conn = await createConnection({ host, port: parseInt(port), user, password, database, ssl: { rejectUnauthorized: true } });

const statements = [
  // 個人雇主基本資料
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS landline VARCHAR(20)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS address VARCHAR(200)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS registeredAddress VARCHAR(200)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS referrer VARCHAR(100)`,
  // 個人雇主專屬
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS idNo VARCHAR(12)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS preCourseNo VARCHAR(50)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS idFrontKey VARCHAR(300)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS idBackKey VARCHAR(300)`,
  // 被照顧者資料
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverNo VARCHAR(20)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverName VARCHAR(50)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverBirthDate VARCHAR(10)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverIdNo VARCHAR(12)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverAddress VARCHAR(200)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverQualification VARCHAR(100)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverRelation VARCHAR(50)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverIdFrontKey VARCHAR(300)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS careReceiverIdBackKey VARCHAR(300)`,
  // 媒合案件
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS caseNo VARCHAR(20)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS caseStatus ENUM('pending','processing','matched','completed','cancelled')`,
  // 申請資格
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS jobSeekerType ENUM('new_hire','renewal','transfer','supplement')`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS jobSeekerDate VARCHAR(10)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS jobSeekerFileKey VARCHAR(300)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS recruitmentLetterType ENUM('domestic','overseas','both')`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS recruitmentLetterDate VARCHAR(10)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS recruitmentLetterFileKey VARCHAR(300)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS recruitmentPermitNote TEXT`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS recruitmentPermitDays INT`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS previousWorkerDepartureDate VARCHAR(10)`,
  // 聘僱函
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS employmentLetterType ENUM('initial','renewal','transfer')`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS employmentLetterDate VARCHAR(10)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS employmentLetterFileKey VARCHAR(300)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS approvedStartDate VARCHAR(10)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS approvedPeriod VARCHAR(50)`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS approvedEndDate VARCHAR(10)`,
];

let success = 0, skipped = 0, failed = 0;
for (const sql of statements) {
  try {
    await conn.execute(sql);
    console.log("✓", sql.substring(0, 80));
    success++;
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("⊘ (already exists)", sql.substring(0, 80));
      skipped++;
    } else {
      console.error("✗ FAILED:", err.message, "\n  SQL:", sql.substring(0, 80));
      failed++;
    }
  }
}

await conn.end();
console.log(`\nDone: ${success} added, ${skipped} skipped, ${failed} failed`);
if (failed > 0) process.exit(1);

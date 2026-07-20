import { createConnection } from "mysql2/promise";
import "dotenv/config";

// 從環境變數取連線字串（本地由 dotenv 從 .env 載入；Manus 是平台直接注入，
// 那裡沒有 .env 檔案，直接 readFileSync 會讓這支腳本在線上跑不起來）。
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 未設定");
  process.exit(1);
}

const conn = await createConnection(dbUrl);

const columns = [
  "ALTER TABLE cases ADD COLUMN prevMedicalExamDate VARCHAR(10) NULL",
  "ALTER TABLE cases ADD COLUMN prevMedicalReportKey VARCHAR(300) NULL",
  "ALTER TABLE cases ADD COLUMN entryMedicalExamDate VARCHAR(10) NULL",
  "ALTER TABLE cases ADD COLUMN entryMedicalReportKey VARCHAR(300) NULL",
  "ALTER TABLE cases ADD COLUMN exam6mDate VARCHAR(10) NULL",
  "ALTER TABLE cases ADD COLUMN exam6mReportKey VARCHAR(300) NULL",
  "ALTER TABLE cases ADD COLUMN exam18mDate VARCHAR(10) NULL",
  "ALTER TABLE cases ADD COLUMN exam18mReportKey VARCHAR(300) NULL",
  "ALTER TABLE cases ADD COLUMN exam30mDate VARCHAR(10) NULL",
  "ALTER TABLE cases ADD COLUMN exam30mReportKey VARCHAR(300) NULL",
];

let success = 0;
let skipped = 0;

for (const sql of columns) {
  try {
    await conn.execute(sql);
    const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
    console.log(`✅ Added: ${col}`);
    success++;
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      const col = sql.match(/ADD COLUMN (\w+)/)?.[1];
      console.log(`⏭  Skipped (already exists): ${col}`);
      skipped++;
    } else {
      console.error(`❌ Error: ${err.message}`);
      console.error(`   SQL: ${sql}`);
    }
  }
}

await conn.end();
console.log(`\n✅ Phase 4 migration done: ${success} added, ${skipped} skipped`);

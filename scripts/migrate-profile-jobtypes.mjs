/**
 * 遷移腳本（idempotent）：worker_public_profiles 加 jobTypes（JSON 陣列，期望職類可多選）。
 * 既有列的 jobType 單值會回填成 jobTypes=[jobType]。
 * 用法：node -r dotenv/config scripts/migrate-profile-jobtypes.mjs
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

if (await columnExists("worker_public_profiles", "jobTypes")) {
  console.log("· worker_public_profiles.jobTypes 已存在，略過");
} else {
  await conn.execute(
    "ALTER TABLE `worker_public_profiles` ADD COLUMN `jobTypes` text"
  );
  console.log("✓ worker_public_profiles.jobTypes 已新增");
  // 回填：既有單值 jobType → jobTypes=[jobType]
  const [res] = await conn.execute(
    `UPDATE worker_public_profiles
       SET jobTypes = JSON_ARRAY(jobType)
     WHERE jobType IS NOT NULL AND (jobTypes IS NULL OR jobTypes = '')`
  );
  console.log(`  ↳ 回填 ${res.affectedRows} 列既有 jobType`);
}
console.log("✓ 完成");
await conn.end();

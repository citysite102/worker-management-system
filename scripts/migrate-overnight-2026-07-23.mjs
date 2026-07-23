/**
 * 遷移腳本（idempotent）：2026-07-23 夜間批次的 schema 變更。
 * 可重複執行——欄位/資料表已存在就略過。
 *
 *   1. worker_public_profiles.preferredCities  text        期望工作地區（JSON 陣列）
 *      ← 缺這欄會讓「找外籍工作者」查詢報 Unknown column 而整頁空白（本次事故主因）
 *   2. ratings            評分（只限已完成聘僱）
 *   3. oauth_identities   社群登入身分 ↔ 本地帳號（Email 合併用）
 *   4. phone_otps         WhatsApp 手機 OTP
 *
 * 用法（對「目標資料庫」執行；記得指向正確的 DATABASE_URL）：
 *   DATABASE_URL="<目標庫連線字串>" node scripts/migrate-overnight-2026-07-23.mjs
 * 或用 .env 的 DATABASE_URL：
 *   node -r dotenv/config scripts/migrate-overnight-2026-07-23.mjs
 */
import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("需要 DATABASE_URL（指向要遷移的資料庫）");
}
const conn = await mysql.createConnection(process.env.DATABASE_URL);

async function columnExists(table, column) {
  const [rows] = await conn.execute(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}
async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`  · ${table}.${column} 已存在，略過`);
    return;
  }
  await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`  ✓ ${table}.${column} 已新增`);
}

console.log("→ 1) worker_public_profiles.preferredCities …");
await addColumn(
  "worker_public_profiles",
  "preferredCities",
  "`preferredCities` text"
);

console.log("→ 2) ratings …");
await conn.query(`CREATE TABLE IF NOT EXISTS \`ratings\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`employmentId\` int NOT NULL,
  \`workerId\` int NOT NULL,
  \`raterUserId\` int NOT NULL,
  \`score\` int NOT NULL,
  \`comment\` varchar(500),
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`ratings_employmentId_idx\` (\`employmentId\`),
  KEY \`ratings_workerId_idx\` (\`workerId\`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
console.log("  ✓ ratings 就緒");

console.log("→ 3) oauth_identities …");
await conn.query(`CREATE TABLE IF NOT EXISTS \`oauth_identities\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`provider\` varchar(20) NOT NULL,
  \`providerUserId\` varchar(191) NOT NULL,
  \`userId\` int NOT NULL,
  \`email\` varchar(320),
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`oauth_identities_provider_idx\` (\`provider\`, \`providerUserId\`),
  KEY \`oauth_identities_userId_idx\` (\`userId\`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
console.log("  ✓ oauth_identities 就緒");

console.log("→ 4) phone_otps …");
await conn.query(`CREATE TABLE IF NOT EXISTS \`phone_otps\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`phone\` varchar(20) NOT NULL,
  \`codeHash\` varchar(128) NOT NULL,
  \`expiresAt\` timestamp NOT NULL,
  \`attempts\` int NOT NULL DEFAULT 0,
  \`consumedAt\` timestamp NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (\`id\`),
  KEY \`phone_otps_phone_idx\` (\`phone\`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
console.log("  ✓ phone_otps 就緒");

console.log("✓ 全部完成");
await conn.end();

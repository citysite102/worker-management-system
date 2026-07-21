/**
 * 遷移腳本（idempotent）：套用 0007_marketplace_p1
 *   - 建立 job_postings、moderation_events（CREATE TABLE IF NOT EXISTS）
 *   - cases 加 publicCity、case_demands 加 publicHidden（先查 information_schema 再 ADD）
 *
 * MySQL 不支援 ADD COLUMN IF NOT EXISTS，故欄位新增前先查 information_schema，
 * 已存在則跳過。可重複執行不報錯。
 *
 * 用法：DATABASE_URL=... node scripts/migrate-marketplace-p1.mjs
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

async function addColumn(table, column, ddl) {
  if (await columnExists(table, column)) {
    console.log(`  ⏭  ${table}.${column} 已存在，跳過`);
    return;
  }
  await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`  ✓ ${table}.${column} 已新增`);
}

console.log("→ 建立 job_postings …");
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`job_postings\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    \`employerUserId\` int NOT NULL,
    \`customerId\` int,
    \`jobType\` enum('caregiver','domestic_helper','manufacturing','agriculture','construction','white_collar','intermediate','overseas_student') NOT NULL,
    \`city\` varchar(20) NOT NULL,
    \`district\` varchar(30),
    \`headcount\` int NOT NULL DEFAULT 1,
    \`employmentType\` enum('live_in','live_out','institution','other') NOT NULL DEFAULT 'live_in',
    \`requirements\` text,
    \`publicDescription\` text,
    \`salaryMin\` int,
    \`salaryMax\` int,
    \`expectedStartDate\` varchar(10),
    \`status\` enum('draft','pending_review','approved','rejected','paused','filled','closed') NOT NULL DEFAULT 'pending_review',
    \`rejectReason\` varchar(300),
    \`caseId\` int,
    \`publishedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    INDEX \`job_postings_employerUserId_idx\` (\`employerUserId\`),
    INDEX \`job_postings_status_idx\` (\`status\`),
    INDEX \`job_postings_caseId_idx\` (\`caseId\`)
  )
`);

console.log("→ 建立 moderation_events …");
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`moderation_events\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    \`entityType\` varchar(50) NOT NULL,
    \`entityId\` int NOT NULL,
    \`action\` enum('submit','approve','reject') NOT NULL,
    \`reason\` text,
    \`staffId\` int,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    INDEX \`moderation_events_entity_idx\` (\`entityType\`,\`entityId\`)
  )
`);

console.log("→ 補欄位 …");
await addColumn(
  "cases",
  "publicCity",
  "`publicCity` varchar(20) DEFAULT NULL COMMENT '公開顯示縣市（去識別）'"
);
await addColumn(
  "case_demands",
  "publicHidden",
  "`publicHidden` int NOT NULL DEFAULT 0 COMMENT '公開站隱藏此需求單 0/1'"
);

console.log("✓ 0007_marketplace_p1 完成");
await conn.end();

/**
 * 遷移腳本（idempotent）：套用 0008_match_requests（媒合意向）。
 *   - 建立 match_requests（CREATE TABLE IF NOT EXISTS）
 *
 * 用法：DATABASE_URL=... node scripts/migrate-match-requests.mjs
 */
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("→ 建立 match_requests …");
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`match_requests\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    \`initiatorUserId\` int NOT NULL,
    \`initiatorType\` enum('worker','employer','other') NOT NULL DEFAULT 'other',
    \`targetType\` enum('job_posting','case_demand','worker') NOT NULL,
    \`targetId\` int NOT NULL,
    \`status\` enum('new','staff_handling','introduced','matched','closed') NOT NULL DEFAULT 'new',
    \`assignedStaffId\` int,
    \`note\` text,
    \`staffNote\` text,
    \`closeReason\` varchar(200),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    INDEX \`match_requests_initiator_idx\` (\`initiatorUserId\`),
    INDEX \`match_requests_target_idx\` (\`targetType\`,\`targetId\`),
    INDEX \`match_requests_status_idx\` (\`status\`)
  )
`);

console.log("✓ 0008_match_requests 完成");
await conn.end();

/**
 * 遷移腳本（idempotent）：套用 0010_email_otp。
 *   - 建 email_otps 表（信箱一次性驗證碼）
 *   - users 加 emailVerified 欄位（0/1）
 *   - 既有帳號 grandfather 為已驗證（emailVerified=1）
 * 用法：DATABASE_URL=... node scripts/migrate-email-otp.mjs
 * 規格：docs/feature-email-otp-verification.md
 */
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("→ 建立 email_otps …");
await conn.execute(`
  CREATE TABLE IF NOT EXISTS \`email_otps\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
    \`email\` varchar(320) NOT NULL,
    \`codeHash\` varchar(128) NOT NULL,
    \`expiresAt\` timestamp NOT NULL,
    \`attempts\` int NOT NULL DEFAULT 0,
    \`consumedAt\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    INDEX \`email_otps_email_idx\` (\`email\`)
  )
`);

console.log("→ users 加 emailVerified 欄位 …");
await conn.execute(
  "ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `emailVerified` int NOT NULL DEFAULT 0"
);

console.log("→ grandfather 既有帳號為已驗證 …");
const [res] = await conn.execute(
  "UPDATE `users` SET `emailVerified` = 1 WHERE `loginMethod` = 'email' OR `email` IS NOT NULL"
);
console.log(`  已回填 ${res.affectedRows ?? 0} 筆`);

console.log("✓ 0010_email_otp 完成");
await conn.end();

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
// MySQL 不支援 ADD COLUMN IF NOT EXISTS，改用 information_schema 存在性守衛。
const [col] = await conn.execute(
  `SELECT COUNT(*) AS n FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'users'
     AND column_name = 'emailVerified'`
);
if ((col[0]?.n ?? 0) > 0) {
  console.log("  已存在，略過");
} else {
  await conn.execute(
    "ALTER TABLE `users` ADD COLUMN `emailVerified` int NOT NULL DEFAULT 0"
  );
  console.log("  已新增");
}

console.log("→ grandfather 既有帳號為已驗證（一次性）…");
const [res] = await conn.execute(
  "UPDATE `users` SET `emailVerified` = 1 WHERE `loginMethod` = 'email' OR `email` IS NOT NULL"
);
console.log(`  已回填 ${res.affectedRows ?? 0} 筆`);

console.log("→ users.email 唯一索引 …");
const [idx] = await conn.execute(
  `SELECT COUNT(*) AS n FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'users'
     AND index_name = 'users_email_unique'`
);
if ((idx[0]?.n ?? 0) > 0) {
  console.log("  已存在，略過");
} else {
  const [dups] = await conn.execute(
    `SELECT email, COUNT(*) AS n FROM users
      WHERE email IS NOT NULL GROUP BY email HAVING n > 1 LIMIT 5`
  );
  if (dups.length > 0) {
    console.error(
      "  ✖ 偵測到重複 email，無法建立唯一索引，請先清理後重跑：",
      dups.map(d => d.email).join(", ")
    );
    process.exit(1);
  }
  await conn.execute(
    "ALTER TABLE `users` ADD UNIQUE INDEX `users_email_unique` (`email`)"
  );
  console.log("  已建立");
}

console.log("✓ 0010_email_otp 完成");
await conn.end();

-- Migration: 0010_email_otp
-- 信箱 OTP 驗證（Email/密碼註冊）：新增 email_otps 表 + users.emailVerified 欄位。
-- 全為 additive；實際套用請跑 `DATABASE_URL=... node scripts/migrate-email-otp.mjs`（idempotent）。
-- 規格：docs/feature-email-otp-verification.md

CREATE TABLE IF NOT EXISTS `email_otps` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `email` varchar(320) NOT NULL,
  `codeHash` varchar(128) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  INDEX `email_otps_email_idx` (`email`)
);

-- 注意：MySQL 不支援 ADD COLUMN IF NOT EXISTS；重複套用請走 scripts/migrate-email-otp.mjs
-- （有 information_schema 存在性守衛）。此檔為單次參考用。
ALTER TABLE `users` ADD COLUMN `emailVerified` int NOT NULL DEFAULT 0;

-- Grandfather（一次性，上線前執行）：既有帳號一律視為已驗證，避免上線瞬間把現有
-- 使用者擋在關鍵動作外。舊的一步 register 已移除，之後不會再有 email 未驗證帳號。
UPDATE `users` SET `emailVerified` = 1 WHERE `loginMethod` = 'email' OR `email` IS NOT NULL;

-- email 唯一索引（DB 層擋重複註冊競態）。MySQL 無 ADD INDEX IF NOT EXISTS，
-- 實務請走 scripts/migrate-email-otp.mjs（有存在性守衛）；若既有資料有重複 email 需先清理。
ALTER TABLE `users` ADD UNIQUE INDEX `users_email_unique` (`email`);

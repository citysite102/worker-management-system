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

ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `emailVerified` int NOT NULL DEFAULT 0;

-- Grandfather：上線前既有帳號一律視為已驗證，避免上線瞬間把現有使用者擋在關鍵動作外。
UPDATE `users` SET `emailVerified` = 1 WHERE `loginMethod` = 'email' OR `email` IS NOT NULL;

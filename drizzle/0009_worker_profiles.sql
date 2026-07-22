-- Migration: 0009_worker_profiles
-- 公開媒合平台 P2：移工匿名公開履歷 + 自填經歷（需審核）。
-- 全為 additive；實際套用請跑 `node scripts/migrate-worker-profiles.mjs`（idempotent）。

CREATE TABLE IF NOT EXISTS `worker_public_profiles` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `userId` int NOT NULL,
  `workerId` int,
  `alias` varchar(50),
  `headline` varchar(120),
  `nationality` varchar(50),
  `yearOfBirth` int,
  `jobType` enum('caregiver','domestic_helper','manufacturing','agriculture','construction','white_collar','intermediate','overseas_student'),
  `skills` text,
  `languages` text,
  `availability` varchar(100),
  `selfIntro` text,
  `publishStatus` enum('draft','published') NOT NULL DEFAULT 'draft',
  `moderationStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejectReason` varchar(300),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `worker_public_profiles_userId_idx` (`userId`),
  INDEX `worker_public_profiles_moderation_idx` (`moderationStatus`)
);

CREATE TABLE IF NOT EXISTS `worker_experiences` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `userId` int NOT NULL,
  `employerType` enum('family_care','institution','manufacturing','agriculture','construction','other') NOT NULL,
  `role` varchar(100) NOT NULL,
  `startDate` varchar(10),
  `endDate` varchar(10),
  `description` text,
  `reviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejectReason` varchar(300),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  INDEX `worker_experiences_userId_idx` (`userId`),
  INDEX `worker_experiences_review_idx` (`reviewStatus`)
);

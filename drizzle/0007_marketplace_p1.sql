-- Migration: 0007_marketplace_p1
-- 公開媒合平台 P1：需求單張貼→審核→轉 case + 找工作列表
--   1. 新增 job_postings（公開需求單）與 moderation_events（審核稽核軌跡）
--   2. cases 新增 publicCity（既有需求單公開曝光用縣市，去識別）
--   3. case_demands 新增 publicHidden（既有需求單逐筆隱藏開關）
-- 全為相容性 additive 變更（不刪不改既有欄位）。
-- 實際套用請跑 `node scripts/migrate-marketplace-p1.mjs`（idempotent）。

CREATE TABLE IF NOT EXISTS `job_postings` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `employerUserId` int NOT NULL,
  `customerId` int,
  `jobType` enum('caregiver','domestic_helper','manufacturing','agriculture','construction','white_collar','intermediate','overseas_student') NOT NULL,
  `city` varchar(20) NOT NULL,
  `district` varchar(30),
  `headcount` int NOT NULL DEFAULT 1,
  `employmentType` enum('live_in','live_out','institution','other') NOT NULL DEFAULT 'live_in',
  `requirements` text,
  `publicDescription` text,
  `salaryMin` int,
  `salaryMax` int,
  `expectedStartDate` varchar(10),
  `status` enum('draft','pending_review','approved','rejected','paused','filled','closed') NOT NULL DEFAULT 'pending_review',
  `rejectReason` varchar(300),
  `caseId` int,
  `publishedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  INDEX `job_postings_employerUserId_idx` (`employerUserId`),
  INDEX `job_postings_status_idx` (`status`),
  INDEX `job_postings_caseId_idx` (`caseId`)
);

CREATE TABLE IF NOT EXISTS `moderation_events` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `entityType` varchar(50) NOT NULL,
  `entityId` int NOT NULL,
  `action` enum('submit','approve','reject') NOT NULL,
  `reason` text,
  `staffId` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  INDEX `moderation_events_entity_idx` (`entityType`,`entityId`)
);

-- cases.publicCity（公開顯示縣市）
ALTER TABLE `cases` ADD COLUMN `publicCity` varchar(20) DEFAULT NULL COMMENT '公開顯示縣市（去識別）';

-- case_demands.publicHidden（逐筆隱藏，0/1）
ALTER TABLE `case_demands` ADD COLUMN `publicHidden` int NOT NULL DEFAULT 0 COMMENT '公開站隱藏此需求單 0/1';

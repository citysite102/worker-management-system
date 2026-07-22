-- Migration: 0008_match_requests
-- 公開媒合平台 P3：媒合意向（仲介居中）。新增 match_requests。
-- 全為 additive；實際套用請跑 `node scripts/migrate-match-requests.mjs`（idempotent）。

CREATE TABLE IF NOT EXISTS `match_requests` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `initiatorUserId` int NOT NULL,
  `initiatorType` enum('worker','employer','other') NOT NULL DEFAULT 'other',
  `targetType` enum('job_posting','case_demand','worker') NOT NULL,
  `targetId` int NOT NULL,
  `status` enum('new','staff_handling','introduced','matched','closed') NOT NULL DEFAULT 'new',
  `assignedStaffId` int,
  `note` text,
  `staffNote` text,
  `closeReason` varchar(200),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  INDEX `match_requests_initiator_idx` (`initiatorUserId`),
  INDEX `match_requests_target_idx` (`targetType`,`targetId`),
  INDEX `match_requests_status_idx` (`status`)
);

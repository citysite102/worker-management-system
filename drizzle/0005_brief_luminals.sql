-- Custom SQL migration file, put your code below! --

-- 1. customer_qualifications: 新增 qualifierCategory 欄位（家庭類/事業類，可擴充）
ALTER TABLE `customer_qualifications`
  ADD COLUMN `qualifierCategory` ENUM('family','business') NOT NULL DEFAULT 'family'
  AFTER `customerId`;

-- 2. cases: 新增 customerQualificationId 欄位（可選連結客戶資格）
ALTER TABLE `cases`
  ADD COLUMN `customerQualificationId` INT NULL
  AFTER `careReceiverId`;
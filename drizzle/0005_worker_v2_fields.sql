-- Migration: workers v2.0 - 對齊 Ragic 外國人資料表欄位
-- 新增基本資料欄位
ALTER TABLE `workers`
  ADD COLUMN `nameEn` varchar(100) DEFAULT NULL COMMENT '英文姓名',
  ADD COLUMN `nameCn` varchar(50) DEFAULT NULL COMMENT '中文姓名',
  ADD COLUMN `birthDate` varchar(10) DEFAULT NULL COMMENT '出生日期',
  ADD COLUMN `gender` enum('male','female','other') DEFAULT NULL COMMENT '性別',
  ADD COLUMN `birthPlace` varchar(100) DEFAULT NULL COMMENT '出生地點',
  ADD COLUMN `occupation` enum('caregiver_family','caregiver_hospital','manufacturing','construction','agriculture','fishery','other') DEFAULT NULL COMMENT '職業',
  -- 證件資料（重命名舊欄位並新增）
  ADD COLUMN `residentPermitNo` varchar(30) DEFAULT NULL COMMENT '統一證碼（居留證號）',
  ADD COLUMN `residentPermitExpiry` varchar(10) DEFAULT NULL COMMENT '居留證有效日期',
  ADD COLUMN `passportNo` varchar(30) DEFAULT NULL COMMENT '護照號碼',
  ADD COLUMN `passportExpiry` varchar(10) DEFAULT NULL COMMENT '護照有效日期',
  -- 聯絡資料
  ADD COLUMN `email` varchar(200) DEFAULT NULL COMMENT '電子信箱',
  -- 體檢資料
  ADD COLUMN `lastMedicalExamDate` varchar(10) DEFAULT NULL COMMENT '最近一次體檢日期',
  ADD COLUMN `nextMedicalExamType` enum('6_month','annual','pre_entry','other') DEFAULT NULL COMMENT '下次需要體檢類型',
  -- 附件 S3 keys
  ADD COLUMN `photoKey` varchar(300) DEFAULT NULL COMMENT '大頭照 S3 key',
  ADD COLUMN `ktpKey` varchar(300) DEFAULT NULL COMMENT '母國身分證(KTP) S3 key',
  ADD COLUMN `residentPermitFrontKey` varchar(300) DEFAULT NULL COMMENT '居留證正面 S3 key',
  ADD COLUMN `residentPermitBackKey` varchar(300) DEFAULT NULL COMMENT '居留證被面 S3 key',
  ADD COLUMN `passportKey` varchar(300) DEFAULT NULL COMMENT '護照 S3 key',
  ADD COLUMN `passportEntryKey` varchar(300) DEFAULT NULL COMMENT '護照入境頁 S3 key',
  ADD COLUMN `medicalReportKey` varchar(300) DEFAULT NULL COMMENT '體檢報告 S3 key';

-- 將現有 idNumber 資料遷移到 residentPermitNo（對應居留證號）
-- 注意：idType = 'resident_permit' 的資料遷移到 residentPermitNo
--       idType = 'passport' 的資料遷移到 passportNo
UPDATE `workers` SET `residentPermitNo` = `idNumber` WHERE `idType` = 'resident_permit';
UPDATE `workers` SET `passportNo` = `idNumber` WHERE `idType` = 'passport';

-- 遷移 idExpiryDate 到 residentPermitExpiry
UPDATE `workers` SET `residentPermitExpiry` = `idExpiryDate` WHERE `idExpiryDate` IS NOT NULL AND `idType` = 'resident_permit';
UPDATE `workers` SET `passportExpiry` = `idExpiryDate` WHERE `idExpiryDate` IS NOT NULL AND `idType` = 'passport';

-- 遷移 name 到 nameCn（現有資料多為中文姓名）
UPDATE `workers` SET `nameCn` = `name` WHERE `nameCn` IS NULL;

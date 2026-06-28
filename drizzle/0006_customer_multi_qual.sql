-- Migration: 0006_customer_multi_qual
-- 新增 customer_care_receivers（被照顧者子表）與 customer_qualifications（申請資格子表）

CREATE TABLE IF NOT EXISTS `customer_care_receivers` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `customerId` int NOT NULL,
  `careReceiverNo` varchar(20),
  `careReceiverName` varchar(50),
  `careReceiverBirthDate` varchar(10),
  `careReceiverIdNo` varchar(12),
  `careReceiverAddress` varchar(200),
  `careReceiverQualification` varchar(100),
  `careReceiverRelation` varchar(50),
  `careReceiverIdFrontKey` varchar(300),
  `careReceiverIdBackKey` varchar(300),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `customer_qualifications` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `customerId` int NOT NULL,
  `careReceiverId` int,
  `caseId` int,
  `label` varchar(100),
  `caseNo` varchar(20),
  `caseStatus` enum('pending','processing','matched','completed','cancelled'),
  `managerId` int,
  `jobSeekerType` enum('new_hire','renewal','transfer','supplement'),
  `jobSeekerDate` varchar(10),
  `jobSeekerFileKey` varchar(300),
  `recruitmentLetterType` enum('domestic','overseas','both'),
  `recruitmentLetterDate` varchar(10),
  `recruitmentLetterFileKey` varchar(300),
  `recruitmentPermitNote` text,
  `recruitmentPermitDays` int,
  `previousWorkerDepartureDate` varchar(10),
  `employmentLetterType` enum('initial','renewal','transfer'),
  `employmentLetterDate` varchar(10),
  `employmentLetterFileKey` varchar(300),
  `approvedStartDate` varchar(10),
  `approvedPeriod` varchar(50),
  `approvedEndDate` varchar(10),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

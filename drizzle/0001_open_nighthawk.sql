CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`taxId` varchar(8),
	`industry` varchar(50),
	`contractStatus` enum('negotiating','signed','in_service','pending_renewal','ended') NOT NULL,
	`pricingTier` enum('standard','custom') NOT NULL,
	`managerId` int NOT NULL,
	`contactName` varchar(50),
	`contactPhone` varchar(20),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `managers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `managers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`nationality` varchar(50),
	`idType` enum('resident_permit','passport') NOT NULL,
	`idNumber` varchar(30) NOT NULL,
	`lifecycleStatus` enum('recruiting','document_processing','employed','pending_renewal','departed') NOT NULL,
	`documentStatus` enum('not_started','pending_supplement','expiring_soon','complete') NOT NULL,
	`managerId` int NOT NULL,
	`phone` varchar(20),
	`entryDate` date,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workers_id` PRIMARY KEY(`id`),
	CONSTRAINT `workers_idNumber_unique` UNIQUE(`idNumber`)
);

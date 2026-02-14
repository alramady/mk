CREATE TABLE `cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameEn` varchar(100) NOT NULL,
	`nameAr` varchar(100) NOT NULL,
	`region` varchar(100),
	`regionAr` varchar(100),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`imageUrl` text,
	`isActive` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `districts` ADD `cityId` int;--> statement-breakpoint
ALTER TABLE `districts` ADD `sortOrder` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `districts` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `districts` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;
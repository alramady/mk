CREATE TABLE `inspectionRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` int NOT NULL,
	`userId` int NOT NULL,
	`managerId` int,
	`requestedDate` timestamp NOT NULL,
	`requestedTimeSlot` varchar(50) NOT NULL,
	`status` enum('pending','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'pending',
	`fullName` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(320),
	`notes` text,
	`adminNotes` text,
	`confirmedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspectionRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `propertyManagerAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`propertyId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propertyManagerAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `propertyManagers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`whatsapp` varchar(20),
	`email` varchar(320),
	`photoUrl` text,
	`bio` text,
	`bioAr` text,
	`title` varchar(100) DEFAULT 'Property Manager',
	`titleAr` varchar(100) DEFAULT 'مدير العقار',
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `propertyManagers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `whatsapp` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `nationalId` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `nationality` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `nationalityAr` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `dateOfBirth` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `address` text;--> statement-breakpoint
ALTER TABLE `users` ADD `addressAr` text;--> statement-breakpoint
ALTER TABLE `users` ADD `emergencyContact` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `emergencyContactName` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `idDocumentUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `profileCompletionPct` int DEFAULT 0;
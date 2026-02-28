-- Migration 0023: Maps location fields + geocode cache
-- 1) Add location metadata columns to properties
ALTER TABLE `properties` ADD COLUMN `locationSource` ENUM('MANUAL','GEOCODE','PIN') DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `properties` ADD COLUMN `locationVisibility` ENUM('EXACT','APPROXIMATE','HIDDEN') NOT NULL DEFAULT 'APPROXIMATE';
--> statement-breakpoint
ALTER TABLE `properties` ADD COLUMN `placeId` varchar(255) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `properties` ADD COLUMN `geocodeProvider` varchar(20) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `properties` ADD COLUMN `geocodeLastCheckedAt` timestamp DEFAULT NULL;
--> statement-breakpoint
-- 2) Create geocode_cache table for cost protection
CREATE TABLE IF NOT EXISTS `geocode_cache` (
  `id` int AUTO_INCREMENT NOT NULL,
  `addressHash` varchar(64) NOT NULL,
  `provider` varchar(20) NOT NULL DEFAULT 'google',
  `lat` decimal(10,7) NOT NULL,
  `lng` decimal(10,7) NOT NULL,
  `placeId` varchar(255) DEFAULT NULL,
  `formattedAddress` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `expiresAt` timestamp NOT NULL,
  `hitCount` int NOT NULL DEFAULT 0,
  CONSTRAINT `geocode_cache_id` PRIMARY KEY(`id`),
  CONSTRAINT `geocode_cache_hash_provider` UNIQUE(`addressHash`, `provider`)
);
--> statement-breakpoint
-- 3) Index for fast cache lookups
CREATE INDEX `idx_geocode_cache_hash` ON `geocode_cache` (`addressHash`);
--> statement-breakpoint
-- 4) Expand audit_log entityType for MAPS
ALTER TABLE `audit_log` MODIFY COLUMN `entityType` ENUM('BUILDING','UNIT','BEDS24_MAP','LEDGER','EXTENSION','PAYMENT_METHOD','PROPERTY','SUBMISSION','INTEGRATION','MAPS','GEOCODE') NOT NULL;
--> statement-breakpoint
-- 5) Expand audit_log action for GEOCODE, PIN_SET
ALTER TABLE `audit_log` MODIFY COLUMN `action` ENUM('CREATE','UPDATE','ARCHIVE','RESTORE','DELETE','LINK_BEDS24','UNLINK_BEDS24','PUBLISH','UNPUBLISH','CONVERT','TEST','ENABLE','DISABLE','GEOCODE','PIN_SET','OVERRIDE') NOT NULL;

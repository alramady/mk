-- Migration 0017: Finance Registry, Buildings, Units, Beds24 Mapping, Payment Ledger
-- This migration is ADDITIVE ONLY — no existing tables are modified (except safe ADD COLUMN).
-- All new tables use IF NOT EXISTS for idempotency.

-- ─── Buildings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `buildings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `buildingId` varchar(20) COMMENT 'Human-friendly ID e.g. BLD-00027',
  `buildingName` varchar(255) NOT NULL,
  `buildingNameAr` varchar(255),
  `address` text,
  `addressAr` text,
  `city` varchar(100),
  `cityAr` varchar(100),
  `district` varchar(100),
  `districtAr` varchar(100),
  `latitude` decimal(10,7),
  `longitude` decimal(10,7),
  `totalUnits` int DEFAULT 0,
  `managerId` int,
  `notes` text,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Units ──────────────────────────────────────────────────────────
-- unitStatus does NOT include OCCUPIED — occupancy is derived from bookings/Beds24
CREATE TABLE IF NOT EXISTS `units` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `unitId` varchar(20) COMMENT 'Human-friendly ID e.g. UNT-01234',
  `buildingId` int NOT NULL,
  `unitNumber` varchar(50) NOT NULL,
  `floor` int,
  `bedrooms` int DEFAULT 1,
  `bathrooms` int DEFAULT 1,
  `sizeSqm` int,
  `unitStatus` enum('AVAILABLE','BLOCKED','MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  `monthlyBaseRentSAR` decimal(10,2),
  `propertyId` int,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_units_buildingId` (`buildingId`),
  INDEX `idx_units_buildingId_status` (`buildingId`, `unitStatus`),
  INDEX `idx_units_propertyId` (`propertyId`),
  INDEX `idx_units_unitNumber` (`unitNumber`)
);

-- ─── Beds24 Mapping (critical safety table) ─────────────────────────
-- UNIQUE constraints prevent double-mapping:
--   UNIQUE(unitId) = one unit → one Beds24 room
--   UNIQUE(beds24RoomId) = one Beds24 room → one unit
CREATE TABLE IF NOT EXISTS `beds24_map` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `unitId` int NOT NULL,
  `beds24PropertyId` varchar(100),
  `beds24RoomId` varchar(100),
  `lastSyncedAt` timestamp NULL,
  `sourceOfTruth` enum('BEDS24','LOCAL') NOT NULL DEFAULT 'BEDS24',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_beds24_unitId` (`unitId`),
  UNIQUE KEY `uq_beds24_roomId` (`beds24RoomId`),
  INDEX `idx_beds24_propertyId` (`beds24PropertyId`)
);

-- ─── Payment Ledger (immutable, audit-grade) ────────────────────────
-- Ledger rows are append-only. PAID amounts MUST NOT be edited.
-- Corrections use ADJUSTMENT/REFUND rows linked via parentLedgerId.
CREATE TABLE IF NOT EXISTS `payment_ledger` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `invoiceNumber` varchar(50) NOT NULL UNIQUE,
  `bookingId` int,
  `beds24BookingId` varchar(100),
  `customerId` int,
  `guestName` varchar(255),
  `guestEmail` varchar(320),
  `guestPhone` varchar(20),
  `buildingId` int,
  `unitId` int,
  `unitNumber` varchar(50),
  `propertyDisplayName` varchar(255),
  `type` enum('RENT','RENEWAL_RENT','PROTECTION_FEE','DEPOSIT','CLEANING','PENALTY','REFUND','ADJUSTMENT') NOT NULL,
  `direction` enum('IN','OUT') NOT NULL DEFAULT 'IN',
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'SAR',
  `status` enum('DUE','PENDING','PAID','FAILED','REFUNDED','VOID') NOT NULL DEFAULT 'DUE',
  `paymentMethod` enum('MADA_CARD','APPLE_PAY','GOOGLE_PAY','TABBY','TAMARA','BANK_TRANSFER','CASH'),
  `provider` enum('moyasar','tabby','tamara','manual'),
  `providerRef` varchar(255),
  `dueAt` timestamp NULL,
  `paidAt` timestamp NULL,
  `createdBy` int,
  `parentLedgerId` int COMMENT 'Links refunds/adjustments to original ledger row',
  `notes` text,
  `notesAr` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ledger_buildingId_status_paidAt` (`buildingId`, `status`, `paidAt`),
  INDEX `idx_ledger_unitId_status_paidAt` (`unitId`, `status`, `paidAt`),
  INDEX `idx_ledger_status_dueAt` (`status`, `dueAt`),
  INDEX `idx_ledger_invoiceNumber` (`invoiceNumber`),
  INDEX `idx_ledger_beds24BookingId` (`beds24BookingId`),
  INDEX `idx_ledger_customerId` (`customerId`),
  INDEX `idx_ledger_bookingId` (`bookingId`),
  INDEX `idx_ledger_parentLedgerId` (`parentLedgerId`)
);

-- ─── Booking Extensions (safe renewal workflow) ─────────────────────
-- Extensions for Beds24-controlled units require admin approval + beds24ChangeNote.
CREATE TABLE IF NOT EXISTS `booking_extensions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `bookingId` int NOT NULL,
  `unitId` int,
  `originalEndDate` timestamp NOT NULL,
  `newEndDate` timestamp NOT NULL,
  `extensionMonths` int NOT NULL DEFAULT 1,
  `status` enum('PENDING_APPROVAL','APPROVED','REJECTED','PAYMENT_PENDING','ACTIVE','CANCELLED') NOT NULL DEFAULT 'PENDING_APPROVAL',
  `beds24Controlled` boolean NOT NULL DEFAULT false,
  `requiresBeds24Update` boolean NOT NULL DEFAULT false,
  `beds24ChangeNote` text COMMENT 'REQUIRED for approval when requiresBeds24Update=true',
  `adminNotes` text,
  `ledgerEntryId` int,
  `requestedBy` int,
  `approvedBy` int,
  `approvedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_ext_bookingId` (`bookingId`),
  INDEX `idx_ext_unitId` (`unitId`),
  INDEX `idx_ext_status` (`status`)
);

-- ─── Unit Daily Status (occupancy snapshots) ────────────────────────
-- source includes UNKNOWN for Beds24-controlled units without data
CREATE TABLE IF NOT EXISTS `unit_daily_status` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `date` timestamp NOT NULL,
  `buildingId` int NOT NULL,
  `unitId` int NOT NULL,
  `occupied` boolean NOT NULL DEFAULT false,
  `available` boolean NOT NULL DEFAULT true,
  `source` enum('BEDS24','LOCAL','UNKNOWN') NOT NULL DEFAULT 'LOCAL',
  `bookingRef` varchar(100),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_daily_date_building` (`date`, `buildingId`),
  INDEX `idx_daily_unitId` (`unitId`),
  UNIQUE KEY `uq_daily_date_unit` (`date`, `unitId`)
);

-- ─── Payment Method Settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `payment_method_settings` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `methodKey` varchar(50) NOT NULL UNIQUE,
  `displayName` varchar(100) NOT NULL,
  `displayNameAr` varchar(100),
  `provider` varchar(50) NOT NULL,
  `isEnabled` boolean NOT NULL DEFAULT false,
  `apiKeyConfigured` boolean NOT NULL DEFAULT false,
  `configJson` json,
  `sortOrder` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Seed default payment methods ───────────────────────────────────
INSERT IGNORE INTO `payment_method_settings` (`methodKey`, `displayName`, `displayNameAr`, `provider`, `isEnabled`, `sortOrder`) VALUES
  ('mada_card', 'Mada Card', 'بطاقة مدى', 'moyasar', false, 1),
  ('apple_pay', 'Apple Pay', 'Apple Pay', 'moyasar', false, 2),
  ('google_pay', 'Google Pay', 'Google Pay', 'moyasar', false, 3),
  ('tabby', 'Tabby (BNPL)', 'تابي (اشتر الآن وادفع لاحقاً)', 'tabby', false, 4),
  ('tamara', 'Tamara (BNPL)', 'تمارا (اشتر الآن وادفع لاحقاً)', 'tamara', false, 5),
  ('bank_transfer', 'Bank Transfer', 'تحويل بنكي', 'manual', false, 6),
  ('cash', 'Cash', 'نقداً', 'manual', false, 7);

-- ─── Add columns to existing bookings table (safe, additive) ────────
ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `beds24BookingId` varchar(100) DEFAULT NULL;
ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `source` enum('BEDS24','LOCAL') DEFAULT 'LOCAL';
ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `renewalsUsed` int DEFAULT 0;
ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `maxRenewals` int DEFAULT 1;
ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `renewalWindowDays` int DEFAULT 14;
ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `buildingId` int DEFAULT NULL;
ALTER TABLE `bookings` ADD COLUMN IF NOT EXISTS `unitId` int DEFAULT NULL;

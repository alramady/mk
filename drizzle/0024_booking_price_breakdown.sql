-- Migration 0024: Add priceBreakdown JSON column to bookings
-- Stores a frozen snapshot of the full fee calculation at booking creation time.
-- Existing bookings are NOT modified — they retain their original totalAmount.
-- A NULL priceBreakdown indicates a "legacy" booking created before this migration.

ALTER TABLE `bookings` ADD COLUMN `priceBreakdown` json DEFAULT NULL;

-- Mark existing bookings as legacy by leaving priceBreakdown NULL.
-- The application code checks: if priceBreakdown IS NULL → legacy booking (base-rent-only total).

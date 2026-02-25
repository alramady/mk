-- Add phone/email verification columns to users
ALTER TABLE `users` ADD COLUMN `phoneVerified` boolean DEFAULT false;
ALTER TABLE `users` ADD COLUMN `emailVerified` boolean DEFAULT false;
ALTER TABLE `users` ADD COLUMN `verificationStatus` enum('pending','phone_verified','email_verified','fully_verified') DEFAULT 'pending';

-- OTP codes table
CREATE TABLE `otp_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`channel` enum('phone','email') NOT NULL,
	`destination` varchar(320) NOT NULL,
	`codeHash` varchar(255) NOT NULL,
	`purpose` varchar(50) NOT NULL DEFAULT 'registration',
	`expiresAt` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 5,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otp_codes_id` PRIMARY KEY(`id`)
);

-- Index for fast lookups
CREATE INDEX `idx_otp_destination_purpose` ON `otp_codes` (`destination`, `purpose`);
CREATE INDEX `idx_otp_expires` ON `otp_codes` (`expiresAt`);

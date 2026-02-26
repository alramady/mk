-- Add recovery email column for account recovery
ALTER TABLE `users` ADD COLUMN `recoveryEmail` varchar(320) DEFAULT NULL;

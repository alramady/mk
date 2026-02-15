ALTER TABLE `payments` ADD `paypalOrderId` varchar(255);--> statement-breakpoint
ALTER TABLE `payments` ADD `paypalCaptureId` varchar(255);--> statement-breakpoint
ALTER TABLE `payments` ADD `payerEmail` varchar(255);--> statement-breakpoint
ALTER TABLE `payments` ADD `paymentMethod` enum('paypal','cash','bank_transfer') DEFAULT 'cash';
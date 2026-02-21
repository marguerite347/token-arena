ALTER TABLE `x402_transactions` ADD `txType` varchar(32) DEFAULT 'x402_payment';--> statement-breakpoint
ALTER TABLE `x402_transactions` ADD `metadata` json;
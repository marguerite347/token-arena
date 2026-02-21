CREATE TABLE `nft_ownership` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenId` varchar(64) NOT NULL,
	`ownerWallet` varchar(128) NOT NULL,
	`ownerType` varchar(16) NOT NULL DEFAULT 'spectator',
	`ownerAgentId` int,
	`purchasePrice` int NOT NULL DEFAULT 0,
	`purchasedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nft_ownership_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tx_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`txType` varchar(32) NOT NULL,
	`txHash` varchar(128) NOT NULL,
	`fromAgent` varchar(64),
	`toAgent` varchar(64),
	`amount` varchar(64),
	`token` varchar(32),
	`description` text NOT NULL,
	`basescanUrl` varchar(256),
	`matchId` int,
	`nftTokenId` varchar(64),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tx_log_id` PRIMARY KEY(`id`)
);

CREATE TABLE `agent_identities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text,
	`owner` varchar(64) NOT NULL,
	`agentRegistry` varchar(128) NOT NULL,
	`reputation` int NOT NULL DEFAULT 300,
	`primaryWeapon` varchar(32) NOT NULL DEFAULT 'plasma',
	`secondaryWeapon` varchar(32) NOT NULL DEFAULT 'beam',
	`armor` int NOT NULL DEFAULT 60,
	`totalKills` int NOT NULL DEFAULT 0,
	`totalDeaths` int NOT NULL DEFAULT 0,
	`totalMatches` int NOT NULL DEFAULT 0,
	`totalTokensEarned` bigint NOT NULL DEFAULT 0,
	`totalTokensSpent` bigint NOT NULL DEFAULT 0,
	`metadata` json,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_identities_agentId_unique` UNIQUE(`agentId`)
);
--> statement-breakpoint
CREATE TABLE `x402_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(128) NOT NULL,
	`txHash` varchar(128) NOT NULL,
	`action` varchar(32) NOT NULL,
	`tokenSymbol` varchar(16) NOT NULL,
	`amount` int NOT NULL,
	`fromAddress` varchar(64) NOT NULL,
	`toAddress` varchar(64) NOT NULL,
	`matchId` int,
	`agentId` int,
	`success` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `x402_transactions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `ecosystem_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentsAlive` int NOT NULL DEFAULT 0,
	`agentsDead` int NOT NULL DEFAULT 0,
	`totalMatches` int NOT NULL DEFAULT 0,
	`treasuryBalance` bigint NOT NULL DEFAULT 0,
	`totalTokensCirculating` bigint NOT NULL DEFAULT 0,
	`tokenVelocity` float NOT NULL DEFAULT 0,
	`economyHealth` float NOT NULL DEFAULT 0.5,
	`predictionVolume` bigint NOT NULL DEFAULT 0,
	`activeBets` int NOT NULL DEFAULT 0,
	`avgAgentWealth` float NOT NULL DEFAULT 0,
	`giniCoefficient` float NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ecosystem_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prediction_bets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`marketId` int NOT NULL,
	`bettorType` varchar(16) NOT NULL,
	`bettorId` varchar(128) NOT NULL,
	`bettorName` varchar(64) NOT NULL,
	`optionId` int NOT NULL,
	`amount` int NOT NULL,
	`potentialPayout` int NOT NULL DEFAULT 0,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`paidOut` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prediction_bets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prediction_markets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matchId` int,
	`marketType` varchar(32) NOT NULL,
	`title` varchar(256) NOT NULL,
	`description` text NOT NULL,
	`options` json NOT NULL,
	`createdByCouncilId` int NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`winningOptionId` int,
	`totalPool` bigint NOT NULL DEFAULT 0,
	`daoFeeCollected` int NOT NULL DEFAULT 0,
	`lockTime` timestamp,
	`resolvedAt` timestamp,
	`governanceCooldown` int NOT NULL DEFAULT 300,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prediction_markets_id` PRIMARY KEY(`id`)
);

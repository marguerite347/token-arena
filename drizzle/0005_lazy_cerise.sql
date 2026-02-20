CREATE TABLE `agent_lifecycle_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`eventType` varchar(16) NOT NULL,
	`reason` text NOT NULL,
	`computeBudgetAtEvent` bigint NOT NULL DEFAULT 0,
	`tokenBalanceAtEvent` bigint NOT NULL DEFAULT 0,
	`proposalId` int,
	`generation` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_lifecycle_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compute_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`action` varchar(32) NOT NULL,
	`computeCost` int NOT NULL,
	`description` text NOT NULL,
	`success` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compute_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dao_council_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`philosophy` varchar(32) NOT NULL,
	`description` text NOT NULL,
	`votingWeight` int NOT NULL DEFAULT 1,
	`totalVotes` int NOT NULL DEFAULT 0,
	`proposalsCreated` int NOT NULL DEFAULT 0,
	`personality` text NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dao_council_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `dao_council_members_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dao_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposedBy` int NOT NULL,
	`proposalType` varchar(32) NOT NULL,
	`title` varchar(128) NOT NULL,
	`description` text NOT NULL,
	`parameters` json NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'voting',
	`votesFor` int NOT NULL DEFAULT 0,
	`votesAgainst` int NOT NULL DEFAULT 0,
	`playerVotesFor` int NOT NULL DEFAULT 0,
	`playerVotesAgainst` int NOT NULL DEFAULT 0,
	`executedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dao_proposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dao_treasury` (
	`id` int AUTO_INCREMENT NOT NULL,
	`txType` varchar(32) NOT NULL,
	`amount` int NOT NULL,
	`direction` varchar(8) NOT NULL,
	`description` text NOT NULL,
	`relatedAgentId` int,
	`relatedMatchId` int,
	`relatedProposalId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dao_treasury_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dao_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` int NOT NULL,
	`voterType` varchar(16) NOT NULL,
	`voterId` int NOT NULL,
	`voterName` varchar(64) NOT NULL,
	`vote` varchar(8) NOT NULL,
	`weight` int NOT NULL DEFAULT 1,
	`reasoning` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dao_votes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fee_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`feeType` varchar(32) NOT NULL,
	`rate` float NOT NULL,
	`flatAmount` int NOT NULL DEFAULT 0,
	`description` text NOT NULL,
	`setByProposalId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fee_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `fee_config_feeType_unique` UNIQUE(`feeType`)
);
--> statement-breakpoint
ALTER TABLE `agent_decisions` ADD `computeCost` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_identities` ADD `computeBudget` bigint DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_identities` ADD `computeSpent` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_identities` ADD `generation` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_identities` ADD `alive` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_identities` ADD `deathReason` varchar(64);--> statement-breakpoint
ALTER TABLE `agent_identities` ADD `spawnedBy` int;--> statement-breakpoint
ALTER TABLE `agent_memory` ADD `computeCost` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_memory` ADD `isPrivate` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_trades` ADD `tradeTax` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crafting_recipes` ADD `craftingTax` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `entryFee` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `arenaBalance` bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `x402_transactions` ADD `feeAmount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `x402_transactions` ADD `feeRecipient` varchar(64);
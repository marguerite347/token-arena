CREATE TABLE `agent_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`action` varchar(32) NOT NULL,
	`target` varchar(64) NOT NULL,
	`reasoning` text NOT NULL,
	`cost` int NOT NULL DEFAULT 0,
	`confidence` float NOT NULL DEFAULT 0.5,
	`outcome` varchar(16),
	`matchId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`itemType` varchar(16) NOT NULL,
	`itemId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_memory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`memoryType` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`confidence` float NOT NULL DEFAULT 0.5,
	`matchesUsed` int NOT NULL DEFAULT 0,
	`successRate` float NOT NULL DEFAULT 0,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_memory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerAgentId` int NOT NULL,
	`buyerAgentId` int NOT NULL,
	`itemType` varchar(32) NOT NULL,
	`itemId` int NOT NULL,
	`price` int NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'completed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crafted_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`craftedBy` int NOT NULL,
	`ownedBy` int NOT NULL,
	`itemType` varchar(32) NOT NULL,
	`itemName` varchar(64) NOT NULL,
	`stats` json NOT NULL,
	`tokenSymbol` varchar(16),
	`rarity` varchar(16) NOT NULL DEFAULT 'common',
	`usesRemaining` int,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crafted_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crafting_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`rarity` varchar(16) NOT NULL DEFAULT 'common',
	`category` varchar(32) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#FFFFFF',
	`dropRate` float NOT NULL DEFAULT 0.1,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crafting_materials_id` PRIMARY KEY(`id`),
	CONSTRAINT `crafting_materials_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `crafting_recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`resultType` varchar(32) NOT NULL,
	`resultName` varchar(64) NOT NULL,
	`resultStats` json NOT NULL,
	`ingredients` json NOT NULL,
	`craftingCost` int NOT NULL DEFAULT 10,
	`discoveredBy` int,
	`isEmergent` int NOT NULL DEFAULT 0,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crafting_recipes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `game_meta_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysis` text NOT NULL,
	`dominantStrategy` varchar(64),
	`economyHealth` float NOT NULL DEFAULT 0.5,
	`actionsTaken` json,
	`newItemsIntroduced` json,
	`balanceChanges` json,
	`matchesAnalyzed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_meta_snapshots_id` PRIMARY KEY(`id`)
);

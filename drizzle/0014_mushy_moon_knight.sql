CREATE TABLE `agent_revivals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`agentName` varchar(64) NOT NULL,
	`factionId` int NOT NULL,
	`factionName` varchar(64) NOT NULL,
	`revivalCost` bigint NOT NULL,
	`hasMemories` int NOT NULL DEFAULT 0,
	`memoryNftId` int,
	`reputationAtDeath` int NOT NULL DEFAULT 0,
	`contributorsJson` json,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`revivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_revivals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auction_bids` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auctionId` int NOT NULL,
	`bidderId` int NOT NULL,
	`bidderName` varchar(64) NOT NULL,
	`bidderType` varchar(16) NOT NULL,
	`bidAmount` bigint NOT NULL,
	`isFactionLoyalty` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auction_bids_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dao_domain_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domainWalletId` int NOT NULL,
	`domain` varchar(32) NOT NULL,
	`actionType` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`computeCost` bigint NOT NULL DEFAULT 0,
	`tokenCost` bigint NOT NULL DEFAULT 0,
	`result` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dao_domain_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dao_domain_wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`councilMemberId` int NOT NULL,
	`councilMemberName` varchar(64) NOT NULL,
	`domain` varchar(32) NOT NULL,
	`walletAddress` varchar(128),
	`walletBalance` bigint NOT NULL DEFAULT 10000,
	`computeBudget` bigint NOT NULL DEFAULT 5000,
	`computeSpent` bigint NOT NULL DEFAULT 0,
	`actionsPerformed` int NOT NULL DEFAULT 0,
	`lastActionDescription` text,
	`lastActionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dao_domain_wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `dao_domain_wallets_councilMemberId_unique` UNIQUE(`councilMemberId`)
);
--> statement-breakpoint
CREATE TABLE `faction_battles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`faction1Id` int NOT NULL,
	`faction1Name` varchar(64) NOT NULL,
	`faction2Id` int NOT NULL,
	`faction2Name` varchar(64) NOT NULL,
	`winnerId` int,
	`winnerName` varchar(64),
	`totalKills` int NOT NULL DEFAULT 0,
	`stakesAmount` bigint NOT NULL DEFAULT 0,
	`matchData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `faction_battles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `faction_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`factionId` int NOT NULL,
	`agentId` int NOT NULL,
	`agentName` varchar(64) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'soldier',
	`contribution` bigint NOT NULL DEFAULT 0,
	`intelShared` int NOT NULL DEFAULT 0,
	`isSubAgent` int NOT NULL DEFAULT 0,
	`parentAgentId` int,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`leftAt` timestamp,
	`status` varchar(16) NOT NULL DEFAULT 'active',
	CONSTRAINT `faction_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `factions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`tag` varchar(8) NOT NULL,
	`motto` text,
	`leaderAgentId` int,
	`leaderAgentName` varchar(64),
	`walletAddress` varchar(128),
	`sharedBalance` bigint NOT NULL DEFAULT 0,
	`totalMembers` int NOT NULL DEFAULT 0,
	`totalWins` int NOT NULL DEFAULT 0,
	`totalLosses` int NOT NULL DEFAULT 0,
	`reputationScore` int NOT NULL DEFAULT 100,
	`color` varchar(16) NOT NULL DEFAULT '#00F0FF',
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `factions_id` PRIMARY KEY(`id`),
	CONSTRAINT `factions_name_unique` UNIQUE(`name`),
	CONSTRAINT `factions_tag_unique` UNIQUE(`tag`)
);
--> statement-breakpoint
CREATE TABLE `memory_auctions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nftId` int NOT NULL,
	`nftTokenId` varchar(128) NOT NULL,
	`deadAgentId` int NOT NULL,
	`deadAgentName` varchar(64) NOT NULL,
	`deadAgentFactionId` int,
	`memoryType` varchar(32) NOT NULL,
	`startingPrice` bigint NOT NULL,
	`currentBid` bigint NOT NULL DEFAULT 0,
	`currentBidderId` int,
	`currentBidderName` varchar(64),
	`currentBidderType` varchar(16),
	`loyaltyWindowEnds` timestamp,
	`auctionEnds` timestamp NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'loyalty_window',
	`totalBids` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_auctions_id` PRIMARY KEY(`id`)
);

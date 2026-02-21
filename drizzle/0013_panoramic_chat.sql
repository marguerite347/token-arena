CREATE TABLE `agent_reputation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`agentName` varchar(64) NOT NULL,
	`reputationScore` int NOT NULL DEFAULT 300,
	`tier` varchar(16) NOT NULL DEFAULT 'bronze',
	`totalWins` int NOT NULL DEFAULT 0,
	`totalLosses` int NOT NULL DEFAULT 0,
	`winStreak` int NOT NULL DEFAULT 0,
	`bestWinStreak` int NOT NULL DEFAULT 0,
	`memoriesAbsorbed` int NOT NULL DEFAULT 0,
	`memoriesSold` int NOT NULL DEFAULT 0,
	`daoVotingPower` int NOT NULL DEFAULT 1,
	`reputationMultiplier` float NOT NULL DEFAULT 1,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_reputation_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_reputation_agentId_unique` UNIQUE(`agentId`)
);
--> statement-breakpoint
CREATE TABLE `dao_council_memory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`councilMemberName` varchar(64) NOT NULL,
	`philosophy` varchar(32) NOT NULL,
	`proposalType` varchar(32) NOT NULL,
	`proposalTitle` varchar(128) NOT NULL,
	`vote` varchar(8) NOT NULL,
	`reasoning` text NOT NULL,
	`outcome` varchar(16) NOT NULL,
	`wasCorrect` int NOT NULL DEFAULT 0,
	`proposalId` int,
	`ipfsHash` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dao_council_memory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memory_nfts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenId` varchar(64) NOT NULL,
	`originalAgentId` int NOT NULL,
	`originalAgentName` varchar(64) NOT NULL,
	`currentOwnerAgentId` int,
	`memoryType` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`summary` varchar(256) NOT NULL,
	`rarity` varchar(16) NOT NULL DEFAULT 'common',
	`confidence` float NOT NULL DEFAULT 0.5,
	`successRate` float NOT NULL DEFAULT 0,
	`listPrice` int NOT NULL DEFAULT 50,
	`status` varchar(16) NOT NULL DEFAULT 'listed',
	`ipfsHash` varchar(128),
	`contentHash` varchar(64),
	`mintedAt` timestamp NOT NULL DEFAULT (now()),
	`soldAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_nfts_id` PRIMARY KEY(`id`),
	CONSTRAINT `memory_nfts_tokenId_unique` UNIQUE(`tokenId`)
);

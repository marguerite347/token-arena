CREATE TABLE `leaderboard` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerName` varchar(64) NOT NULL,
	`totalMatches` int NOT NULL DEFAULT 0,
	`totalWins` int NOT NULL DEFAULT 0,
	`totalKills` int NOT NULL DEFAULT 0,
	`totalDeaths` int NOT NULL DEFAULT 0,
	`totalTokensEarned` bigint NOT NULL DEFAULT 0,
	`totalTokensSpent` bigint NOT NULL DEFAULT 0,
	`bestKillStreak` int NOT NULL DEFAULT 0,
	`favoriteWeapon` varchar(32),
	`walletAddress` varchar(64),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leaderboard_id` PRIMARY KEY(`id`),
	CONSTRAINT `leaderboard_playerName_unique` UNIQUE(`playerName`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mode` varchar(16) NOT NULL,
	`duration` int NOT NULL,
	`skyboxPrompt` text,
	`skyboxUrl` text,
	`playerName` varchar(64) NOT NULL,
	`playerKills` int NOT NULL DEFAULT 0,
	`playerDeaths` int NOT NULL DEFAULT 0,
	`tokensEarned` int NOT NULL DEFAULT 0,
	`tokensSpent` int NOT NULL DEFAULT 0,
	`tokenNet` int NOT NULL DEFAULT 0,
	`result` varchar(16) NOT NULL,
	`weaponUsed` varchar(32),
	`agentData` json,
	`walletAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `skybox_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prompt` text NOT NULL,
	`styleId` int NOT NULL,
	`skyboxId` int,
	`fileUrl` text,
	`thumbUrl` text,
	`depthMapUrl` text,
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skybox_cache_id` PRIMARY KEY(`id`)
);

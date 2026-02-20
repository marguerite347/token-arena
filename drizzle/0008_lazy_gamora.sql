ALTER TABLE `agent_identities` ADD `memorySize` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_identities` ADD `memoryCostPerCycle` int DEFAULT 0 NOT NULL;
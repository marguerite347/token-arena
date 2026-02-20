import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Match history — records every completed match
 */
export const matches = mysqlTable("matches", {
  id: int("id").autoincrement().primaryKey(),
  mode: varchar("mode", { length: 16 }).notNull(), // pvai | aivai
  duration: int("duration").notNull(), // seconds
  skyboxPrompt: text("skyboxPrompt"),
  skyboxUrl: text("skyboxUrl"),
  playerName: varchar("playerName", { length: 64 }).notNull(),
  playerKills: int("playerKills").notNull().default(0),
  playerDeaths: int("playerDeaths").notNull().default(0),
  tokensEarned: int("tokensEarned").notNull().default(0),
  tokensSpent: int("tokensSpent").notNull().default(0),
  tokenNet: int("tokenNet").notNull().default(0),
  result: varchar("result", { length: 16 }).notNull(), // victory | defeat | spectated
  weaponUsed: varchar("weaponUsed", { length: 32 }),
  agentData: json("agentData"), // JSON array of agent results
  walletAddress: varchar("walletAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Match = typeof matches.$inferSelect;
export type InsertMatch = typeof matches.$inferInsert;

/**
 * Leaderboard — aggregated player stats
 */
export const leaderboard = mysqlTable("leaderboard", {
  id: int("id").autoincrement().primaryKey(),
  playerName: varchar("playerName", { length: 64 }).notNull().unique(),
  totalMatches: int("totalMatches").notNull().default(0),
  totalWins: int("totalWins").notNull().default(0),
  totalKills: int("totalKills").notNull().default(0),
  totalDeaths: int("totalDeaths").notNull().default(0),
  totalTokensEarned: bigint("totalTokensEarned", { mode: "number" }).notNull().default(0),
  totalTokensSpent: bigint("totalTokensSpent", { mode: "number" }).notNull().default(0),
  bestKillStreak: int("bestKillStreak").notNull().default(0),
  favoriteWeapon: varchar("favoriteWeapon", { length: 32 }),
  walletAddress: varchar("walletAddress", { length: 64 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LeaderboardEntry = typeof leaderboard.$inferSelect;
export type InsertLeaderboardEntry = typeof leaderboard.$inferInsert;

/**
 * Skybox cache — store generated skybox URLs to avoid re-generation
 */
export const skyboxCache = mysqlTable("skybox_cache", {
  id: int("id").autoincrement().primaryKey(),
  prompt: text("prompt").notNull(),
  styleId: int("styleId").notNull(),
  skyboxId: int("skyboxId"),
  fileUrl: text("fileUrl"),
  thumbUrl: text("thumbUrl"),
  depthMapUrl: text("depthMapUrl"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SkyboxCacheEntry = typeof skyboxCache.$inferSelect;

/**
 * ERC-8004 Agent Identities — on-chain agent personas
 */
export const agentIdentities = mysqlTable("agent_identities", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description"),
  owner: varchar("owner", { length: 64 }).notNull(), // wallet address
  agentRegistry: varchar("agentRegistry", { length: 128 }).notNull(),
  reputation: int("reputation").notNull().default(300), // stored as x100 (3.00 = 300)
  primaryWeapon: varchar("primaryWeapon", { length: 32 }).notNull().default("plasma"),
  secondaryWeapon: varchar("secondaryWeapon", { length: 32 }).notNull().default("beam"),
  armor: int("armor").notNull().default(60),
  totalKills: int("totalKills").notNull().default(0),
  totalDeaths: int("totalDeaths").notNull().default(0),
  totalMatches: int("totalMatches").notNull().default(0),
  totalTokensEarned: bigint("totalTokensEarned", { mode: "number" }).notNull().default(0),
  totalTokensSpent: bigint("totalTokensSpent", { mode: "number" }).notNull().default(0),
  metadata: json("metadata"),
  active: int("active").notNull().default(1), // boolean as int
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentIdentityRow = typeof agentIdentities.$inferSelect;
export type InsertAgentIdentity = typeof agentIdentities.$inferInsert;

/**
 * x402 Transaction Log — records all x402 payment transactions
 */
export const x402Transactions = mysqlTable("x402_transactions", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 128 }).notNull(),
  txHash: varchar("txHash", { length: 128 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(), // shoot, hit, purchase, collect
  tokenSymbol: varchar("tokenSymbol", { length: 16 }).notNull(),
  amount: int("amount").notNull(),
  fromAddress: varchar("fromAddress", { length: 64 }).notNull(),
  toAddress: varchar("toAddress", { length: 64 }).notNull(),
  matchId: int("matchId"),
  agentId: int("agentId"),
  success: int("success").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type X402TransactionRow = typeof x402Transactions.$inferSelect;
export type InsertX402Transaction = typeof x402Transactions.$inferInsert;

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

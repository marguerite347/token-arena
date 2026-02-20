import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json, float } from "drizzle-orm/mysql-core";

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
  mode: varchar("mode", { length: 16 }).notNull(),
  duration: int("duration").notNull(),
  skyboxPrompt: text("skyboxPrompt"),
  skyboxUrl: text("skyboxUrl"),
  playerName: varchar("playerName", { length: 64 }).notNull(),
  playerKills: int("playerKills").notNull().default(0),
  playerDeaths: int("playerDeaths").notNull().default(0),
  tokensEarned: int("tokensEarned").notNull().default(0),
  tokensSpent: int("tokensSpent").notNull().default(0),
  tokenNet: int("tokenNet").notNull().default(0),
  result: varchar("result", { length: 16 }).notNull(),
  weaponUsed: varchar("weaponUsed", { length: 32 }),
  agentData: json("agentData"),
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
 * Skybox cache
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
  owner: varchar("owner", { length: 64 }).notNull(),
  agentRegistry: varchar("agentRegistry", { length: 128 }).notNull(),
  reputation: int("reputation").notNull().default(300),
  primaryWeapon: varchar("primaryWeapon", { length: 32 }).notNull().default("plasma"),
  secondaryWeapon: varchar("secondaryWeapon", { length: 32 }).notNull().default("beam"),
  armor: int("armor").notNull().default(60),
  totalKills: int("totalKills").notNull().default(0),
  totalDeaths: int("totalDeaths").notNull().default(0),
  totalMatches: int("totalMatches").notNull().default(0),
  totalTokensEarned: bigint("totalTokensEarned", { mode: "number" }).notNull().default(0),
  totalTokensSpent: bigint("totalTokensSpent", { mode: "number" }).notNull().default(0),
  metadata: json("metadata"),
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentIdentityRow = typeof agentIdentities.$inferSelect;
export type InsertAgentIdentity = typeof agentIdentities.$inferInsert;

/**
 * x402 Transaction Log
 */
export const x402Transactions = mysqlTable("x402_transactions", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: varchar("paymentId", { length: 128 }).notNull(),
  txHash: varchar("txHash", { length: 128 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
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

/**
 * Agent Memory — persistent learning across matches
 * Stores LLM-generated insights, strategy evaluations, and learned patterns
 */
export const agentMemory = mysqlTable("agent_memory", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  memoryType: varchar("memoryType", { length: 32 }).notNull(), // strategy | weapon_eval | economy | trade | craft
  content: text("content").notNull(), // LLM-generated insight
  confidence: float("confidence").notNull().default(0.5),
  matchesUsed: int("matchesUsed").notNull().default(0), // how many matches this memory informed
  successRate: float("successRate").notNull().default(0), // outcome when using this memory
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentMemoryRow = typeof agentMemory.$inferSelect;
export type InsertAgentMemory = typeof agentMemory.$inferInsert;

/**
 * Agent Decisions — log of every autonomous decision an agent makes
 */
export const agentDecisions = mysqlTable("agent_decisions", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  action: varchar("action", { length: 32 }).notNull(), // buy_weapon | change_loadout | craft | trade | save_tokens
  target: varchar("target", { length: 64 }).notNull(), // what was bought/crafted/traded
  reasoning: text("reasoning").notNull(), // LLM-generated explanation
  cost: int("cost").notNull().default(0),
  confidence: float("confidence").notNull().default(0.5),
  outcome: varchar("outcome", { length: 16 }), // success | failure | pending
  matchId: int("matchId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentDecisionRow = typeof agentDecisions.$inferSelect;
export type InsertAgentDecision = typeof agentDecisions.$inferInsert;

/**
 * Crafting Materials — collectible resources found during battles
 */
export const craftingMaterials = mysqlTable("crafting_materials", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description").notNull(),
  rarity: varchar("rarity", { length: 16 }).notNull().default("common"), // common | uncommon | rare | epic | legendary
  category: varchar("category", { length: 32 }).notNull(), // energy_core | metal_shard | crystal | circuit | exotic_matter | void_essence
  color: varchar("color", { length: 16 }).notNull().default("#FFFFFF"),
  dropRate: float("dropRate").notNull().default(0.1), // probability per kill
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CraftingMaterialRow = typeof craftingMaterials.$inferSelect;
export type InsertCraftingMaterial = typeof craftingMaterials.$inferInsert;

/**
 * Crafting Recipes — how to combine materials into items
 * Can be discovered by agents or introduced by the Master Game Design Agent
 */
export const craftingRecipes = mysqlTable("crafting_recipes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").notNull(),
  resultType: varchar("resultType", { length: 32 }).notNull(), // weapon | armor | consumable | trap | environmental | ammo
  resultName: varchar("resultName", { length: 64 }).notNull(),
  resultStats: json("resultStats").notNull(), // { damage, fireRate, range, special, etc }
  ingredients: json("ingredients").notNull(), // [{ materialId, quantity }]
  craftingCost: int("craftingCost").notNull().default(10), // ARENA tokens to craft
  discoveredBy: int("discoveredBy"), // agentId who first discovered this recipe
  isEmergent: int("isEmergent").notNull().default(0), // 1 if LLM-generated
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CraftingRecipeRow = typeof craftingRecipes.$inferSelect;
export type InsertCraftingRecipe = typeof craftingRecipes.$inferInsert;

/**
 * Crafted Items — unique items created by agents
 * Each becomes a new token type in the game economy
 */
export const craftedItems = mysqlTable("crafted_items", {
  id: int("id").autoincrement().primaryKey(),
  recipeId: int("recipeId").notNull(),
  craftedBy: int("craftedBy").notNull(), // agentId
  ownedBy: int("ownedBy").notNull(), // current owner agentId
  itemType: varchar("itemType", { length: 32 }).notNull(),
  itemName: varchar("itemName", { length: 64 }).notNull(),
  stats: json("stats").notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 16 }), // if tokenized
  rarity: varchar("rarity", { length: 16 }).notNull().default("common"),
  usesRemaining: int("usesRemaining"), // null = infinite
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CraftedItemRow = typeof craftedItems.$inferSelect;
export type InsertCraftedItem = typeof craftedItems.$inferInsert;

/**
 * Agent Inventory — what materials and items each agent holds
 */
export const agentInventory = mysqlTable("agent_inventory", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  itemType: varchar("itemType", { length: 16 }).notNull(), // material | crafted | weapon | consumable
  itemId: int("itemId").notNull(), // references craftingMaterials.id or craftedItems.id
  quantity: int("quantity").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentInventoryRow = typeof agentInventory.$inferSelect;
export type InsertAgentInventory = typeof agentInventory.$inferInsert;

/**
 * Game Meta Snapshots — Master Game Design Agent's view of the economy
 */
export const gameMetaSnapshots = mysqlTable("game_meta_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  analysis: text("analysis").notNull(), // LLM-generated meta analysis
  dominantStrategy: text("dominantStrategy"),
  economyHealth: float("economyHealth").notNull().default(0.5), // 0=broken, 1=perfect
  actionsTaken: json("actionsTaken"), // what the master agent did in response
  newItemsIntroduced: json("newItemsIntroduced"), // items added to shop
  balanceChanges: json("balanceChanges"), // cost/stat adjustments
  matchesAnalyzed: int("matchesAnalyzed").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameMetaSnapshotRow = typeof gameMetaSnapshots.$inferSelect;
export type InsertGameMetaSnapshot = typeof gameMetaSnapshots.$inferInsert;

/**
 * Agent Trades — buy/sell/trade between agents
 */
export const agentTrades = mysqlTable("agent_trades", {
  id: int("id").autoincrement().primaryKey(),
  sellerAgentId: int("sellerAgentId").notNull(),
  buyerAgentId: int("buyerAgentId").notNull(),
  itemType: varchar("itemType", { length: 32 }).notNull(),
  itemId: int("itemId").notNull(),
  price: int("price").notNull(), // in ARENA tokens
  status: varchar("status", { length: 16 }).notNull().default("completed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentTradeRow = typeof agentTrades.$inferSelect;
export type InsertAgentTrade = typeof agentTrades.$inferInsert;

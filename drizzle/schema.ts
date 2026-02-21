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
  arenaBalance: bigint("arenaBalance", { mode: "number" }).notNull().default(0),
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
  entryFee: int("entryFee").notNull().default(0),
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
  sceneAnalysis: json("sceneAnalysis"),
  sceneGraph: json("sceneGraph"),
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
  computeBudget: bigint("computeBudget", { mode: "number" }).notNull().default(1000),
  computeSpent: bigint("computeSpent", { mode: "number" }).notNull().default(0),
  memorySize: int("memorySize").notNull().default(0),
  memoryCostPerCycle: int("memoryCostPerCycle").notNull().default(0),
  generation: int("generation").notNull().default(1),
  alive: int("alive").notNull().default(1),
  deathReason: varchar("deathReason", { length: 64 }),
  spawnedBy: int("spawnedBy"),
  llmModel: varchar("llmModel", { length: 64 }).default("gpt-4o"),
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
  txType: varchar("txType", { length: 32 }).default("x402_payment"),
  tokenSymbol: varchar("tokenSymbol", { length: 16 }).notNull(),
  amount: int("amount").notNull(),
  fromAddress: varchar("fromAddress", { length: 64 }).notNull(),
  toAddress: varchar("toAddress", { length: 64 }).notNull(),
  matchId: int("matchId"),
  agentId: int("agentId"),
  feeAmount: int("feeAmount").notNull().default(0),
  feeRecipient: varchar("feeRecipient", { length: 64 }),
  success: int("success").notNull().default(1),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type X402TransactionRow = typeof x402Transactions.$inferSelect;
export type InsertX402Transaction = typeof x402Transactions.$inferInsert;

/**
 * Agent Memory — persistent learning across matches
 */
export const agentMemory = mysqlTable("agent_memory", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  memoryType: varchar("memoryType", { length: 32 }).notNull(),
  content: text("content").notNull(),
  confidence: float("confidence").notNull().default(0.5),
  matchesUsed: int("matchesUsed").notNull().default(0),
  successRate: float("successRate").notNull().default(0),
  computeCost: int("computeCost").notNull().default(1),
  isPrivate: int("isPrivate").notNull().default(1),
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
  action: varchar("action", { length: 32 }).notNull(),
  target: varchar("target", { length: 64 }).notNull(),
  reasoning: text("reasoning").notNull(),
  cost: int("cost").notNull().default(0),
  computeCost: int("computeCost").notNull().default(0),
  confidence: float("confidence").notNull().default(0.5),
  outcome: varchar("outcome", { length: 16 }),
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
  rarity: varchar("rarity", { length: 16 }).notNull().default("common"),
  category: varchar("category", { length: 32 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#FFFFFF"),
  dropRate: float("dropRate").notNull().default(0.1),
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CraftingMaterialRow = typeof craftingMaterials.$inferSelect;
export type InsertCraftingMaterial = typeof craftingMaterials.$inferInsert;

/**
 * Crafting Recipes
 */
export const craftingRecipes = mysqlTable("crafting_recipes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  description: text("description").notNull(),
  resultType: varchar("resultType", { length: 32 }).notNull(),
  resultName: varchar("resultName", { length: 64 }).notNull(),
  resultStats: json("resultStats").notNull(),
  ingredients: json("ingredients").notNull(),
  craftingCost: int("craftingCost").notNull().default(10),
  craftingTax: int("craftingTax").notNull().default(2),
  discoveredBy: int("discoveredBy"),
  isEmergent: int("isEmergent").notNull().default(0),
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CraftingRecipeRow = typeof craftingRecipes.$inferSelect;
export type InsertCraftingRecipe = typeof craftingRecipes.$inferInsert;

/**
 * Crafted Items
 */
export const craftedItems = mysqlTable("crafted_items", {
  id: int("id").autoincrement().primaryKey(),
  recipeId: int("recipeId").notNull(),
  craftedBy: int("craftedBy").notNull(),
  ownedBy: int("ownedBy").notNull(),
  itemType: varchar("itemType", { length: 32 }).notNull(),
  itemName: varchar("itemName", { length: 64 }).notNull(),
  stats: json("stats").notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 16 }),
  rarity: varchar("rarity", { length: 16 }).notNull().default("common"),
  usesRemaining: int("usesRemaining"),
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CraftedItemRow = typeof craftedItems.$inferSelect;
export type InsertCraftedItem = typeof craftedItems.$inferInsert;

/**
 * Agent Inventory
 */
export const agentInventory = mysqlTable("agent_inventory", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  itemType: varchar("itemType", { length: 16 }).notNull(),
  itemId: int("itemId").notNull(),
  quantity: int("quantity").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgentInventoryRow = typeof agentInventory.$inferSelect;
export type InsertAgentInventory = typeof agentInventory.$inferInsert;

/**
 * Game Meta Snapshots
 */
export const gameMetaSnapshots = mysqlTable("game_meta_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  analysis: text("analysis").notNull(),
  dominantStrategy: text("dominantStrategy"),
  economyHealth: float("economyHealth").notNull().default(0.5),
  actionsTaken: json("actionsTaken"),
  newItemsIntroduced: json("newItemsIntroduced"),
  balanceChanges: json("balanceChanges"),
  matchesAnalyzed: int("matchesAnalyzed").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GameMetaSnapshotRow = typeof gameMetaSnapshots.$inferSelect;
export type InsertGameMetaSnapshot = typeof gameMetaSnapshots.$inferInsert;

/**
 * Agent Trades
 */
export const agentTrades = mysqlTable("agent_trades", {
  id: int("id").autoincrement().primaryKey(),
  sellerAgentId: int("sellerAgentId").notNull(),
  buyerAgentId: int("buyerAgentId").notNull(),
  itemType: varchar("itemType", { length: 32 }).notNull(),
  itemId: int("itemId").notNull(),
  price: int("price").notNull(),
  tradeTax: int("tradeTax").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("completed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentTradeRow = typeof agentTrades.$inferSelect;
export type InsertAgentTrade = typeof agentTrades.$inferInsert;

// ============================================================
// v6 — DAO Governance, Agent Lifecycle & Token Economics
// ============================================================

/**
 * DAO Council Members — master agents with different philosophies
 * Each has voting power and a distinct approach to game balance
 */
export const daoCouncilMembers = mysqlTable("dao_council_members", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  philosophy: varchar("philosophy", { length: 32 }).notNull(), // growth | stability | chaos | fairness | innovation
  description: text("description").notNull(),
  votingWeight: int("votingWeight").notNull().default(1),
  totalVotes: int("totalVotes").notNull().default(0),
  proposalsCreated: int("proposalsCreated").notNull().default(0),
  personality: text("personality").notNull(), // LLM system prompt for this council member
  active: int("active").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DaoCouncilMemberRow = typeof daoCouncilMembers.$inferSelect;
export type InsertDaoCouncilMember = typeof daoCouncilMembers.$inferInsert;

/**
 * DAO Proposals — decisions that the council votes on
 */
export const daoProposals = mysqlTable("dao_proposals", {
  id: int("id").autoincrement().primaryKey(),
  proposedBy: int("proposedBy").notNull(), // council member id
  proposalType: varchar("proposalType", { length: 32 }).notNull(), // spawn_agent | kill_agent | new_item | fee_change | nerf | buff | economy_intervention
  title: varchar("title", { length: 128 }).notNull(),
  description: text("description").notNull(),
  parameters: json("parameters").notNull(), // type-specific params
  status: varchar("status", { length: 16 }).notNull().default("voting"), // voting | passed | rejected | executed | expired
  votesFor: int("votesFor").notNull().default(0),
  votesAgainst: int("votesAgainst").notNull().default(0),
  playerVotesFor: int("playerVotesFor").notNull().default(0),
  playerVotesAgainst: int("playerVotesAgainst").notNull().default(0),
  executedAt: timestamp("executedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DaoProposalRow = typeof daoProposals.$inferSelect;
export type InsertDaoProposal = typeof daoProposals.$inferInsert;

/**
 * DAO Votes — individual votes from council members and players
 */
export const daoVotes = mysqlTable("dao_votes", {
  id: int("id").autoincrement().primaryKey(),
  proposalId: int("proposalId").notNull(),
  voterType: varchar("voterType", { length: 16 }).notNull(), // council | player
  voterId: int("voterId").notNull(), // council member id or user id
  voterName: varchar("voterName", { length: 64 }).notNull(),
  vote: varchar("vote", { length: 8 }).notNull(), // for | against
  weight: int("weight").notNull().default(1), // based on ARENA balance for players
  reasoning: text("reasoning"), // LLM-generated for council members
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DaoVoteRow = typeof daoVotes.$inferSelect;
export type InsertDaoVote = typeof daoVotes.$inferInsert;

/**
 * DAO Treasury — tracks all fee inflows and expenditures
 */
export const daoTreasury = mysqlTable("dao_treasury", {
  id: int("id").autoincrement().primaryKey(),
  txType: varchar("txType", { length: 32 }).notNull(), // match_fee | craft_tax | shop_fee | trade_tax | death_tax | conversion_spread | spawn_cost | compute_grant | data_purchase
  amount: int("amount").notNull(),
  direction: varchar("direction", { length: 8 }).notNull(), // inflow | outflow
  description: text("description").notNull(),
  relatedAgentId: int("relatedAgentId"),
  relatedMatchId: int("relatedMatchId"),
  relatedProposalId: int("relatedProposalId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DaoTreasuryRow = typeof daoTreasury.$inferSelect;
export type InsertDaoTreasury = typeof daoTreasury.$inferInsert;

/**
 * Agent Lifecycle Events — births, deaths, resurrections
 */
export const agentLifecycleEvents = mysqlTable("agent_lifecycle_events", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  eventType: varchar("eventType", { length: 16 }).notNull(), // spawn | death | resurrect
  reason: text("reason").notNull(),
  computeBudgetAtEvent: bigint("computeBudgetAtEvent", { mode: "number" }).notNull().default(0),
  tokenBalanceAtEvent: bigint("tokenBalanceAtEvent", { mode: "number" }).notNull().default(0),
  proposalId: int("proposalId"), // if spawned/killed by DAO vote
  generation: int("generation").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentLifecycleEventRow = typeof agentLifecycleEvents.$inferSelect;
export type InsertAgentLifecycleEvent = typeof agentLifecycleEvents.$inferInsert;

/**
 * Compute Ledger — tracks compute token spending per agent
 * Every LLM call, Skybox generation, memory maintenance costs compute
 */
export const computeLedger = mysqlTable("compute_ledger", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  action: varchar("action", { length: 32 }).notNull(), // reasoning | memory_maintain | skybox_gen | craft_discover | trade_negotiate | memory_prune
  computeCost: int("computeCost").notNull(),
  description: text("description").notNull(),
  success: int("success").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComputeLedgerRow = typeof computeLedger.$inferSelect;
export type InsertComputeLedger = typeof computeLedger.$inferInsert;

/**
 * Fee Configuration — current fee rates set by the DAO
 */
export const feeConfig = mysqlTable("fee_config", {
  id: int("id").autoincrement().primaryKey(),
  feeType: varchar("feeType", { length: 32 }).notNull().unique(), // match_entry | crafting_tax | shop_tx | trade_tax | death_tax | conversion_spread | memory_maintain
  rate: float("rate").notNull(), // percentage (0.05 = 5%)
  flatAmount: int("flatAmount").notNull().default(0), // flat fee in ARENA tokens
  description: text("description").notNull(),
  setByProposalId: int("setByProposalId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeeConfigRow = typeof feeConfig.$inferSelect;
export type InsertFeeConfig = typeof feeConfig.$inferInsert;

// ============================================================
// v7 — Prediction Market
// ============================================================

/**
 * Prediction Markets — DAO-created markets for match outcomes
 */
export const predictionMarkets = mysqlTable("prediction_markets", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId"), // null if pre-match
  marketType: varchar("marketType", { length: 32 }).notNull(), // match_winner | total_kills | token_volume | survival_count | first_blood | mvp
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  options: json("options").notNull(), // [{id, label, odds}]
  createdByCouncilId: int("createdByCouncilId").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"), // open | locked | resolved | cancelled
  winningOptionId: int("winningOptionId"),
  totalPool: bigint("totalPool", { mode: "number" }).notNull().default(0),
  daoFeeCollected: int("daoFeeCollected").notNull().default(0),
  lockTime: timestamp("lockTime"), // when betting closes (before match starts)
  resolvedAt: timestamp("resolvedAt"),
  governanceCooldown: int("governanceCooldown").notNull().default(300), // seconds before DAO can act after creating market
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PredictionMarketRow = typeof predictionMarkets.$inferSelect;
export type InsertPredictionMarket = typeof predictionMarkets.$inferInsert;

/**
 * Prediction Bets — individual bets placed by players and agents
 */
export const predictionBets = mysqlTable("prediction_bets", {
  id: int("id").autoincrement().primaryKey(),
  marketId: int("marketId").notNull(),
  bettorType: varchar("bettorType", { length: 16 }).notNull(), // player | agent | spectator
  bettorId: varchar("bettorId", { length: 128 }).notNull(), // user id, agent id, or wallet address
  bettorName: varchar("bettorName", { length: 64 }).notNull(),
  optionId: int("optionId").notNull(),
  amount: int("amount").notNull(),
  potentialPayout: int("potentialPayout").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | won | lost | refunded
  paidOut: int("paidOut").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PredictionBetRow = typeof predictionBets.$inferSelect;
export type InsertPredictionBet = typeof predictionBets.$inferInsert;

/**
 * Ecosystem Snapshots — periodic snapshots of the full ecosystem state for the dashboard
 */
export const ecosystemSnapshots = mysqlTable("ecosystem_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  agentsAlive: int("agentsAlive").notNull().default(0),
  agentsDead: int("agentsDead").notNull().default(0),
  totalMatches: int("totalMatches").notNull().default(0),
  treasuryBalance: bigint("treasuryBalance", { mode: "number" }).notNull().default(0),
  totalTokensCirculating: bigint("totalTokensCirculating", { mode: "number" }).notNull().default(0),
  tokenVelocity: float("tokenVelocity").notNull().default(0),
  economyHealth: float("economyHealth").notNull().default(0.5),
  predictionVolume: bigint("predictionVolume", { mode: "number" }).notNull().default(0),
  activeBets: int("activeBets").notNull().default(0),
  avgAgentWealth: float("avgAgentWealth").notNull().default(0),
  giniCoefficient: float("giniCoefficient").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EcosystemSnapshotRow = typeof ecosystemSnapshots.$inferSelect;
export type InsertEcosystemSnapshot = typeof ecosystemSnapshots.$inferInsert;

/**
 * Match Replays — server-side storage of match replay data
 * Stores compressed replay frames, events, highlights for playback
 */
export const matchReplays = mysqlTable("match_replays", {
  id: int("id").autoincrement().primaryKey(),
  matchId: int("matchId"),
  replayId: varchar("replayId", { length: 64 }).notNull().unique(),
  mode: varchar("mode", { length: 16 }).notNull().default("aivai"),
  duration: int("duration").notNull().default(0), // ms
  totalKills: int("totalKills").notNull().default(0),
  mvpName: varchar("mvpName", { length: 64 }),
  mvpKills: int("mvpKills").notNull().default(0),
  mvpTokens: int("mvpTokens").notNull().default(0),
  result: varchar("result", { length: 128 }),
  skyboxUrl: text("skyboxUrl"),
  skyboxPrompt: text("skyboxPrompt"),
  agents: json("agents"), // [{id, name, color}]
  highlights: json("highlights"), // ReplayHighlight[]
  events: json("events"), // ReplayEvent[] (kills, weapon switches, etc.)
  frames: json("frames"), // Compressed ReplayFrame[] (every 3rd frame)
  combatLog: json("combatLog"), // Detailed play-by-play text log
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MatchReplayRow = typeof matchReplays.$inferSelect;
export type InsertMatchReplay = typeof matchReplays.$inferInsert;

// ============================================================
// v13 — DAO Council Memory, Memory NFTs, Agent Reputation
// ============================================================

/**
 * DAO Council Memory — persistent deliberation history for council members
 * Council members recall past decisions to build institutional knowledge
 */
export const daoCouncilMemory = mysqlTable("dao_council_memory", {
  id: int("id").autoincrement().primaryKey(),
  councilMemberName: varchar("councilMemberName", { length: 64 }).notNull(),
  philosophy: varchar("philosophy", { length: 32 }).notNull(),
  proposalType: varchar("proposalType", { length: 32 }).notNull(),
  proposalTitle: varchar("proposalTitle", { length: 128 }).notNull(),
  vote: varchar("vote", { length: 8 }).notNull(), // for | against
  reasoning: text("reasoning").notNull(),
  outcome: varchar("outcome", { length: 16 }).notNull(), // passed | rejected
  wasCorrect: int("wasCorrect").notNull().default(0), // 1 if vote aligned with outcome
  proposalId: int("proposalId"),
  ipfsHash: varchar("ipfsHash", { length: 128 }), // IPFS-ready content hash
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DaoCouncilMemoryRow = typeof daoCouncilMemory.$inferSelect;
export type InsertDaoCouncilMemory = typeof daoCouncilMemory.$inferInsert;

/**
 * Memory NFTs — tradeable memories from dead agents
 * When an agent dies, their memories can be minted as NFTs
 * Other agents can buy these to absorb the dead agent's knowledge
 */
export const memoryNfts = mysqlTable("memory_nfts", {
  id: int("id").autoincrement().primaryKey(),
  tokenId: varchar("tokenId", { length: 64 }).notNull().unique(), // simulated NFT token ID
  originalAgentId: int("originalAgentId").notNull(), // dead agent who owned this memory
  originalAgentName: varchar("originalAgentName", { length: 64 }).notNull(),
  currentOwnerAgentId: int("currentOwnerAgentId"), // null = on marketplace
  memoryType: varchar("memoryType", { length: 32 }).notNull(), // strategy | failure | economy | combat | arena
  content: text("content").notNull(), // the actual memory/knowledge
  summary: varchar("summary", { length: 256 }).notNull(), // short description for marketplace
  rarity: varchar("rarity", { length: 16 }).notNull().default("common"), // common | rare | epic | legendary
  confidence: float("confidence").notNull().default(0.5),
  successRate: float("successRate").notNull().default(0),
  listPrice: int("listPrice").notNull().default(50), // ARENA tokens
  status: varchar("status", { length: 16 }).notNull().default("listed"), // listed | sold | absorbed | burned
  ipfsHash: varchar("ipfsHash", { length: 128 }), // IPFS content hash for decentralized storage
  contentHash: varchar("contentHash", { length: 64 }), // SHA-256 of content for integrity
  mintedAt: timestamp("mintedAt").defaultNow().notNull(),
  soldAt: timestamp("soldAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MemoryNftRow = typeof memoryNfts.$inferSelect;
export type InsertMemoryNft = typeof memoryNfts.$inferInsert;

/**
 * Agent Reputation — tracks reputation scores and history
 * Reputation affects match rewards, market access, and DAO voting weight
 */
export const agentReputation = mysqlTable("agent_reputation", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull().unique(),
  agentName: varchar("agentName", { length: 64 }).notNull(),
  reputationScore: int("reputationScore").notNull().default(300), // 0-1000, starts at 300
  tier: varchar("tier", { length: 16 }).notNull().default("bronze"), // bronze | silver | gold | platinum | legendary
  totalWins: int("totalWins").notNull().default(0),
  totalLosses: int("totalLosses").notNull().default(0),
  winStreak: int("winStreak").notNull().default(0),
  bestWinStreak: int("bestWinStreak").notNull().default(0),
  memoriesAbsorbed: int("memoriesAbsorbed").notNull().default(0), // NFT memories bought
  memoriesSold: int("memoriesSold").notNull().default(0),
  daoVotingPower: int("daoVotingPower").notNull().default(1), // scales with reputation
  reputationMultiplier: float("reputationMultiplier").notNull().default(1.0), // reward multiplier
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentReputationRow = typeof agentReputation.$inferSelect;
export type InsertAgentReputation = typeof agentReputation.$inferInsert;


// ═══════════════════════════════════════════════════════════════════════════
// v25 — Factions, Auctions, Revival, DAO Domain Controllers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Factions / Swarms — agents form teams that share resources and intel
 */
export const factions = mysqlTable("factions", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  tag: varchar("tag", { length: 8 }).notNull().unique(), // e.g. [APEX], [VOID]
  motto: text("motto"),
  leaderAgentId: int("leaderAgentId"),
  leaderAgentName: varchar("leaderAgentName", { length: 64 }),
  walletAddress: varchar("walletAddress", { length: 128 }),
  sharedBalance: bigint("sharedBalance", { mode: "number" }).notNull().default(0),
  totalMembers: int("totalMembers").notNull().default(0),
  totalWins: int("totalWins").notNull().default(0),
  totalLosses: int("totalLosses").notNull().default(0),
  reputationScore: int("reputationScore").notNull().default(100),
  color: varchar("color", { length: 16 }).notNull().default("#00F0FF"),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | disbanded
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FactionRow = typeof factions.$inferSelect;
export type InsertFaction = typeof factions.$inferInsert;

/**
 * Faction Members — tracks which agents belong to which faction
 */
export const factionMembers = mysqlTable("faction_members", {
  id: int("id").autoincrement().primaryKey(),
  factionId: int("factionId").notNull(),
  agentId: int("agentId").notNull(),
  agentName: varchar("agentName", { length: 64 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("soldier"), // leader | officer | soldier | recruit
  contribution: bigint("contribution", { mode: "number" }).notNull().default(0), // tokens contributed
  intelShared: int("intelShared").notNull().default(0), // memories shared with faction
  isSubAgent: int("isSubAgent").notNull().default(0), // 1 if spawned by parent agent
  parentAgentId: int("parentAgentId"), // null if original agent
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | defected | dead
});
export type FactionMemberRow = typeof factionMembers.$inferSelect;
export type InsertFactionMember = typeof factionMembers.$inferInsert;

/**
 * Faction Battles — faction vs faction coordinated team fights
 */
export const factionBattles = mysqlTable("faction_battles", {
  id: int("id").autoincrement().primaryKey(),
  faction1Id: int("faction1Id").notNull(),
  faction1Name: varchar("faction1Name", { length: 64 }).notNull(),
  faction2Id: int("faction2Id").notNull(),
  faction2Name: varchar("faction2Name", { length: 64 }).notNull(),
  winnerId: int("winnerId"),
  winnerName: varchar("winnerName", { length: 64 }),
  totalKills: int("totalKills").notNull().default(0),
  stakesAmount: bigint("stakesAmount", { mode: "number" }).notNull().default(0),
  matchData: json("matchData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FactionBattleRow = typeof factionBattles.$inferSelect;

/**
 * Memory Auctions — competitive bidding on dead agent memories
 * Home faction gets first dibs (loyalty window), then open bidding
 */
export const memoryAuctions = mysqlTable("memory_auctions", {
  id: int("id").autoincrement().primaryKey(),
  nftId: int("nftId").notNull(), // references memoryNfts.id
  nftTokenId: varchar("nftTokenId", { length: 128 }).notNull(),
  deadAgentId: int("deadAgentId").notNull(),
  deadAgentName: varchar("deadAgentName", { length: 64 }).notNull(),
  deadAgentFactionId: int("deadAgentFactionId"), // null if lone wolf
  memoryType: varchar("memoryType", { length: 32 }).notNull(),
  startingPrice: bigint("startingPrice", { mode: "number" }).notNull(),
  currentBid: bigint("currentBid", { mode: "number" }).notNull().default(0),
  currentBidderId: int("currentBidderId"), // agent or faction id
  currentBidderName: varchar("currentBidderName", { length: 64 }),
  currentBidderType: varchar("currentBidderType", { length: 16 }), // agent | faction
  loyaltyWindowEnds: timestamp("loyaltyWindowEnds"), // home faction exclusive window
  auctionEnds: timestamp("auctionEnds").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("loyalty_window"), // loyalty_window | open | sold | expired
  totalBids: int("totalBids").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MemoryAuctionRow = typeof memoryAuctions.$inferSelect;
export type InsertMemoryAuction = typeof memoryAuctions.$inferInsert;

/**
 * Auction Bids — individual bids on memory auctions
 */
export const auctionBids = mysqlTable("auction_bids", {
  id: int("id").autoincrement().primaryKey(),
  auctionId: int("auctionId").notNull(),
  bidderId: int("bidderId").notNull(),
  bidderName: varchar("bidderName", { length: 64 }).notNull(),
  bidderType: varchar("bidderType", { length: 16 }).notNull(), // agent | faction
  bidAmount: bigint("bidAmount", { mode: "number" }).notNull(),
  isFactionLoyalty: int("isFactionLoyalty").notNull().default(0), // 1 if during loyalty window
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuctionBidRow = typeof auctionBids.$inferSelect;

/**
 * Agent Revivals — factions pool tokens to revive dead agents
 * If faction still holds Memory NFT, agent returns with memories intact
 */
export const agentRevivals = mysqlTable("agent_revivals", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  agentName: varchar("agentName", { length: 64 }).notNull(),
  factionId: int("factionId").notNull(),
  factionName: varchar("factionName", { length: 64 }).notNull(),
  revivalCost: bigint("revivalCost", { mode: "number" }).notNull(),
  hasMemories: int("hasMemories").notNull().default(0), // 1 if faction holds the Memory NFT
  memoryNftId: int("memoryNftId"), // which NFT was used (null if blank slate)
  reputationAtDeath: int("reputationAtDeath").notNull().default(0),
  contributorsJson: json("contributorsJson"), // agents who pooled tokens
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | funded | revived | failed
  revivedAt: timestamp("revivedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AgentRevivalRow = typeof agentRevivals.$inferSelect;
export type InsertAgentRevival = typeof agentRevivals.$inferInsert;

/**
 * DAO Domain Wallets — each DAO council master controls a domain with own budget
 * ARCHON→matchmaking, FORGE→economy, ENTROPY→arenas, JUSTICE→rules, EQUILIBRIA→balance
 */
export const daoDomainWallets = mysqlTable("dao_domain_wallets", {
  id: int("id").autoincrement().primaryKey(),
  councilMemberId: int("councilMemberId").notNull().unique(),
  councilMemberName: varchar("councilMemberName", { length: 64 }).notNull(),
  domain: varchar("domain", { length: 32 }).notNull(), // matchmaking | economy | arenas | rules | balance
  walletAddress: varchar("walletAddress", { length: 128 }),
  walletBalance: bigint("walletBalance", { mode: "number" }).notNull().default(10000),
  computeBudget: bigint("computeBudget", { mode: "number" }).notNull().default(5000),
  computeSpent: bigint("computeSpent", { mode: "number" }).notNull().default(0),
  actionsPerformed: int("actionsPerformed").notNull().default(0),
  lastActionDescription: text("lastActionDescription"),
  lastActionAt: timestamp("lastActionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DaoDomainWalletRow = typeof daoDomainWallets.$inferSelect;
export type InsertDaoDomainWallet = typeof daoDomainWallets.$inferInsert;

/**
 * DAO Domain Actions — log of autonomous actions taken by each domain controller
 */
export const daoDomainActions = mysqlTable("dao_domain_actions", {
  id: int("id").autoincrement().primaryKey(),
  domainWalletId: int("domainWalletId").notNull(),
  domain: varchar("domain", { length: 32 }).notNull(),
  actionType: varchar("actionType", { length: 64 }).notNull(),
  description: text("description").notNull(),
  computeCost: bigint("computeCost", { mode: "number" }).notNull().default(0),
  tokenCost: bigint("tokenCost", { mode: "number" }).notNull().default(0),
  result: text("result"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DaoDomainActionRow = typeof daoDomainActions.$inferSelect;

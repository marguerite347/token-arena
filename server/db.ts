import { eq, desc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, matches, leaderboard, skyboxCache, agentIdentities, x402Transactions,
  agentMemory, agentDecisions, craftingMaterials, craftingRecipes, craftedItems, agentInventory,
  gameMetaSnapshots, agentTrades,
  type InsertMatch, type InsertAgentIdentity, type InsertX402Transaction,
  type InsertAgentMemory, type InsertAgentDecision, type InsertCraftingMaterial,
  type InsertCraftingRecipe, type InsertCraftedItem, type InsertAgentInventory,
  type InsertGameMetaSnapshot, type InsertAgentTrade,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Match History ────────────────────────────────────────────────────────────

export async function saveMatch(match: InsertMatch) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(matches).values(match);
  return result[0].insertId;
}

export async function getRecentMatches(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);
}

export async function getMatchesByPlayer(playerName: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(matches).where(eq(matches.playerName, playerName)).orderBy(desc(matches.createdAt)).limit(limit);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function upsertLeaderboardEntry(data: {
  playerName: string; kills: number; deaths: number;
  tokensEarned: number; tokensSpent: number; won: boolean;
  weapon: string; walletAddress?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(leaderboard).where(eq(leaderboard.playerName, data.playerName)).limit(1);
  if (existing.length > 0) {
    const entry = existing[0];
    await db.update(leaderboard).set({
      totalMatches: (entry.totalMatches ?? 0) + 1,
      totalWins: (entry.totalWins ?? 0) + (data.won ? 1 : 0),
      totalKills: (entry.totalKills ?? 0) + data.kills,
      totalDeaths: (entry.totalDeaths ?? 0) + data.deaths,
      totalTokensEarned: (entry.totalTokensEarned ?? 0) + data.tokensEarned,
      totalTokensSpent: (entry.totalTokensSpent ?? 0) + data.tokensSpent,
      bestKillStreak: Math.max(entry.bestKillStreak ?? 0, data.kills),
      favoriteWeapon: data.weapon,
      walletAddress: data.walletAddress || entry.walletAddress,
    }).where(eq(leaderboard.playerName, data.playerName));
  } else {
    await db.insert(leaderboard).values({
      playerName: data.playerName, totalMatches: 1, totalWins: data.won ? 1 : 0,
      totalKills: data.kills, totalDeaths: data.deaths,
      totalTokensEarned: data.tokensEarned, totalTokensSpent: data.tokensSpent,
      bestKillStreak: data.kills, favoriteWeapon: data.weapon, walletAddress: data.walletAddress,
    });
  }
}

export async function getLeaderboard(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leaderboard).orderBy(desc(leaderboard.totalKills)).limit(limit);
}

// ─── Skybox Cache ─────────────────────────────────────────────────────────────

export async function cacheSkybox(data: { prompt: string; styleId: number; skyboxId?: number; fileUrl?: string; thumbUrl?: string; depthMapUrl?: string; status: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(skyboxCache).values(data);
  return result[0].insertId;
}

export async function getSkyboxByPrompt(prompt: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(skyboxCache).where(eq(skyboxCache.prompt, prompt)).limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function updateSkyboxCache(id: number, data: { skyboxId?: number; fileUrl?: string; thumbUrl?: string; depthMapUrl?: string; status: string; sceneAnalysis?: unknown }) {
  const db = await getDb();
  if (!db) return;
  await db.update(skyboxCache).set(data).where(eq(skyboxCache.id, id));
}

export async function getRandomCachedSkybox() {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(skyboxCache).where(eq(skyboxCache.status, "complete")).orderBy(sql`RAND()`).limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function getCachedSkyboxByStyleId(styleId: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(skyboxCache).where(and(eq(skyboxCache.styleId, styleId), eq(skyboxCache.status, "complete"))).limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function getAllCachedSkyboxes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(skyboxCache).where(eq(skyboxCache.status, "complete"));
}

// ─── Agent Identities (ERC-8004) ──────────────────────────────────────────────

export async function getAgentIdentities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentIdentities).orderBy(agentIdentities.agentId);
}

export async function getAgentById(agentId: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(agentIdentities).where(eq(agentIdentities.agentId, agentId)).limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function upsertAgentIdentity(data: InsertAgentIdentity) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(agentIdentities).where(eq(agentIdentities.agentId, data.agentId)).limit(1);
  if (existing.length > 0) {
    await db.update(agentIdentities).set({
      name: data.name, description: data.description, owner: data.owner,
      agentRegistry: data.agentRegistry, reputation: data.reputation,
      primaryWeapon: data.primaryWeapon, secondaryWeapon: data.secondaryWeapon,
      armor: data.armor, metadata: data.metadata,
    }).where(eq(agentIdentities.agentId, data.agentId));
  } else {
    await db.insert(agentIdentities).values(data);
  }
}

export async function updateAgentStats(agentId: number, stats: { kills?: number; deaths?: number; tokensEarned?: number; tokensSpent?: number }) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(agentIdentities).where(eq(agentIdentities.agentId, agentId)).limit(1);
  if (existing.length === 0) return;
  const entry = existing[0];
  await db.update(agentIdentities).set({
    totalKills: (entry.totalKills ?? 0) + (stats.kills ?? 0),
    totalDeaths: (entry.totalDeaths ?? 0) + (stats.deaths ?? 0),
    totalMatches: (entry.totalMatches ?? 0) + 1,
    totalTokensEarned: (entry.totalTokensEarned ?? 0) + (stats.tokensEarned ?? 0),
    totalTokensSpent: (entry.totalTokensSpent ?? 0) + (stats.tokensSpent ?? 0),
  }).where(eq(agentIdentities.agentId, agentId));
}

export async function updateAgentLoadout(agentId: number, loadout: { primaryWeapon?: string; secondaryWeapon?: string; armor?: number }) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = {};
  if (loadout.primaryWeapon) updateData.primaryWeapon = loadout.primaryWeapon;
  if (loadout.secondaryWeapon) updateData.secondaryWeapon = loadout.secondaryWeapon;
  if (loadout.armor !== undefined) updateData.armor = loadout.armor;
  if (Object.keys(updateData).length > 0) {
    await db.update(agentIdentities).set(updateData).where(eq(agentIdentities.agentId, agentId));
  }
}

// ─── x402 Transactions ────────────────────────────────────────────────────────

export async function logX402Transaction(data: InsertX402Transaction) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(x402Transactions).values(data);
  return result[0].insertId;
}

export async function getRecentX402Transactions(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(x402Transactions).orderBy(desc(x402Transactions.createdAt)).limit(limit);
}

export async function getX402TransactionsByMatch(matchId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(x402Transactions).where(eq(x402Transactions.matchId, matchId)).orderBy(desc(x402Transactions.createdAt));
}

// ─── Agent Memory (Persistent Learning) ──────────────────────────────────────

export async function saveAgentMemory(data: InsertAgentMemory) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(agentMemory).values(data);
  return result[0].insertId;
}

export async function getAgentMemories(agentId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentMemory)
    .where(eq(agentMemory.agentId, agentId))
    .orderBy(desc(agentMemory.updatedAt))
    .limit(limit);
}

export async function updateMemorySuccess(memoryId: number, success: boolean) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(agentMemory).where(eq(agentMemory.id, memoryId)).limit(1);
  if (existing.length === 0) return;
  const mem = existing[0];
  const newUsed = (mem.matchesUsed ?? 0) + 1;
  const oldRate = mem.successRate ?? 0;
  const newRate = ((oldRate * (newUsed - 1)) + (success ? 1 : 0)) / newUsed;
  await db.update(agentMemory).set({
    matchesUsed: newUsed,
    successRate: newRate,
    confidence: Math.min(0.95, (mem.confidence ?? 0.5) + (success ? 0.05 : -0.05)),
  }).where(eq(agentMemory.id, memoryId));
}

// ─── Agent Decisions ─────────────────────────────────────────────────────────

export async function saveAgentDecision(data: InsertAgentDecision) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(agentDecisions).values(data);
  return result[0].insertId;
}

export async function getAgentDecisionHistory(agentId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentDecisions)
    .where(eq(agentDecisions.agentId, agentId))
    .orderBy(desc(agentDecisions.createdAt))
    .limit(limit);
}

export async function updateDecisionOutcome(decisionId: number, outcome: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(agentDecisions).set({ outcome }).where(eq(agentDecisions.id, decisionId));
}

// ─── Crafting Materials ──────────────────────────────────────────────────────

export async function seedMaterials(materials: InsertCraftingMaterial[]) {
  const db = await getDb();
  if (!db) return;
  for (const mat of materials) {
    const existing = await db.select().from(craftingMaterials).where(eq(craftingMaterials.name, mat.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(craftingMaterials).values(mat);
    }
  }
}

export async function getAllMaterials() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(craftingMaterials).orderBy(craftingMaterials.name);
}

export async function getMaterialByName(name: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(craftingMaterials).where(eq(craftingMaterials.name, name)).limit(1);
  return results.length > 0 ? results[0] : null;
}

// ─── Crafting Recipes ────────────────────────────────────────────────────────

export async function saveRecipe(data: InsertCraftingRecipe) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(craftingRecipes).values(data);
  return result[0].insertId;
}

export async function seedRecipes(recipes: InsertCraftingRecipe[]) {
  const db = await getDb();
  if (!db) return;
  for (const recipe of recipes) {
    const existing = await db.select().from(craftingRecipes).where(eq(craftingRecipes.name, recipe.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(craftingRecipes).values(recipe);
    }
  }
}

export async function getAvailableRecipes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(craftingRecipes).where(eq(craftingRecipes.active, 1));
}

export async function getRecipeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(craftingRecipes).where(eq(craftingRecipes.id, id)).limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function getEmergentRecipes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(craftingRecipes).where(eq(craftingRecipes.isEmergent, 1)).orderBy(desc(craftingRecipes.createdAt));
}

// ─── Crafted Items ───────────────────────────────────────────────────────────

export async function saveCraftedItem(data: InsertCraftedItem) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(craftedItems).values(data);
  return result[0].insertId;
}

export async function getCraftedItemsByAgent(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(craftedItems).where(eq(craftedItems.ownedBy, agentId));
}

export async function getRecentCraftedItems(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(craftedItems).orderBy(desc(craftedItems.createdAt)).limit(limit);
}

export async function transferCraftedItem(itemId: number, newOwnerId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(craftedItems).set({ ownedBy: newOwnerId }).where(eq(craftedItems.id, itemId));
}

// ─── Agent Inventory ─────────────────────────────────────────────────────────

export async function getAgentInventoryItems(agentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentInventory).where(eq(agentInventory.agentId, agentId));
}

export async function addToInventory(data: InsertAgentInventory) {
  const db = await getDb();
  if (!db) return;
  // Check if agent already has this item type+id
  const existing = await db.select().from(agentInventory)
    .where(eq(agentInventory.agentId, data.agentId))
    .limit(100);
  const match = existing.find(e => e.itemType === data.itemType && e.itemId === data.itemId);
  if (match) {
    await db.update(agentInventory).set({
      quantity: (match.quantity ?? 0) + (data.quantity ?? 1),
    }).where(eq(agentInventory.id, match.id));
  } else {
    await db.insert(agentInventory).values(data);
  }
}

export async function removeFromInventory(agentId: number, itemType: string, itemId: number, quantity: number) {
  const db = await getDb();
  if (!db) return false;
  const existing = await db.select().from(agentInventory)
    .where(eq(agentInventory.agentId, agentId))
    .limit(100);
  const match = existing.find(e => e.itemType === itemType && e.itemId === itemId);
  if (!match || (match.quantity ?? 0) < quantity) return false;
  const newQty = (match.quantity ?? 0) - quantity;
  if (newQty <= 0) {
    await db.delete(agentInventory).where(eq(agentInventory.id, match.id));
  } else {
    await db.update(agentInventory).set({ quantity: newQty }).where(eq(agentInventory.id, match.id));
  }
  return true;
}

// ─── Agent Trades ────────────────────────────────────────────────────────────

export async function saveTrade(data: InsertAgentTrade) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(agentTrades).values(data);
  return result[0].insertId;
}

export async function getRecentTrades(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentTrades).orderBy(desc(agentTrades.createdAt)).limit(limit);
}

// ─── Game Meta Snapshots ─────────────────────────────────────────────────────

export async function saveMetaSnapshot(data: InsertGameMetaSnapshot) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(gameMetaSnapshots).values(data);
  return result[0].insertId;
}

export async function getLatestMetaSnapshot() {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(gameMetaSnapshots).orderBy(desc(gameMetaSnapshots.createdAt)).limit(1);
  return results.length > 0 ? results[0] : null;
}

export async function getMetaSnapshots(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(gameMetaSnapshots).orderBy(desc(gameMetaSnapshots.createdAt)).limit(limit);
}

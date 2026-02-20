import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, matches, leaderboard, skyboxCache, agentIdentities, x402Transactions, type InsertMatch, type InsertLeaderboardEntry, type InsertAgentIdentity, type InsertX402Transaction } from "../drizzle/schema";
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
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

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
  playerName: string;
  kills: number;
  deaths: number;
  tokensEarned: number;
  tokensSpent: number;
  won: boolean;
  weapon: string;
  walletAddress?: string;
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
      playerName: data.playerName,
      totalMatches: 1,
      totalWins: data.won ? 1 : 0,
      totalKills: data.kills,
      totalDeaths: data.deaths,
      totalTokensEarned: data.tokensEarned,
      totalTokensSpent: data.tokensSpent,
      bestKillStreak: data.kills,
      favoriteWeapon: data.weapon,
      walletAddress: data.walletAddress,
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

export async function updateSkyboxCache(id: number, data: { skyboxId?: number; fileUrl?: string; thumbUrl?: string; depthMapUrl?: string; status: string }) {
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
      name: data.name,
      description: data.description,
      owner: data.owner,
      agentRegistry: data.agentRegistry,
      reputation: data.reputation,
      primaryWeapon: data.primaryWeapon,
      secondaryWeapon: data.secondaryWeapon,
      armor: data.armor,
      metadata: data.metadata,
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

/**
 * Agent Revival Service
 * 
 * Factions pool ARENA tokens to revive dead agents.
 * If the faction still holds the Memory NFT, the agent returns with memories intact.
 * If a rival bought the memories, the agent comes back as a blank slate.
 * Revival cost scales with agent reputation.
 */
import { getDb } from "./db";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";

// ─── Calculate revival cost based on reputation ─────────────────────────────
export function calculateRevivalCost(reputationScore: number): number {
  // Base cost: 200 ARENA
  // Legendary agents (900+): 2000 ARENA
  // Gold agents (600+): 800 ARENA
  // Silver agents (400+): 400 ARENA
  // Bronze agents (<400): 200 ARENA
  if (reputationScore >= 900) return 2000;
  if (reputationScore >= 600) return 800;
  if (reputationScore >= 400) return 400;
  return 200;
}

// ─── Initiate revival request ───────────────────────────────────────────────
export async function initiateRevival(params: {
  agentId: number;
  agentName: string;
  factionId: number;
  factionName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { agentRevivals, agentIdentities, agentReputation, memoryNfts, factions } = await import("../drizzle/schema");

  // Check agent is actually dead
  const [agent] = await db.select().from(agentIdentities).where(eq(agentIdentities.id, params.agentId));
  if (!agent) throw new Error("Agent not found");
  if (agent.alive === 1) throw new Error("Agent is still alive — no revival needed");

  // Get reputation for cost calculation
  const [rep] = await db.select().from(agentReputation).where(eq(agentReputation.agentId, params.agentId));
  const repScore = rep?.reputationScore || 300;
  const cost = calculateRevivalCost(repScore);

  // Check if faction holds the memory NFT
  const factionNfts = await db.select().from(memoryNfts)
    .where(and(
      eq(memoryNfts.originalAgentId, params.agentId),
      eq(memoryNfts.status, "absorbed"),
    ));

  // Check if any faction member owns the NFT
  const { factionMembers } = await import("../drizzle/schema");
  const members = await db.select().from(factionMembers)
    .where(and(eq(factionMembers.factionId, params.factionId), eq(factionMembers.status, "active")));
  const memberIds = members.map(m => m.agentId);

  const hasMemories = factionNfts.some(nft => nft.currentOwnerAgentId && memberIds.includes(nft.currentOwnerAgentId));
  const memoryNftId = hasMemories ? factionNfts.find(nft => nft.currentOwnerAgentId && memberIds.includes(nft.currentOwnerAgentId))?.id : null;

  // Check faction balance
  const [faction] = await db.select().from(factions).where(eq(factions.id, params.factionId));
  if (!faction) throw new Error("Faction not found");

  const [revival] = await db.insert(agentRevivals).values({
    agentId: params.agentId,
    agentName: params.agentName,
    factionId: params.factionId,
    factionName: params.factionName,
    revivalCost: cost,
    hasMemories: hasMemories ? 1 : 0,
    memoryNftId: memoryNftId || null,
    reputationAtDeath: repScore,
    status: faction.sharedBalance >= cost ? "funded" : "pending",
  }).$returningId();

  return {
    revivalId: revival.id,
    cost,
    hasMemories,
    factionBalance: faction.sharedBalance,
    canAfford: faction.sharedBalance >= cost,
    status: faction.sharedBalance >= cost ? "funded" : "pending",
  };
}

// ─── Execute revival (after funding confirmed) ──────────────────────────────
export async function executeRevival(revivalId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { agentRevivals, agentIdentities, factions, agentMemory } = await import("../drizzle/schema");

  const [revival] = await db.select().from(agentRevivals).where(eq(agentRevivals.id, revivalId));
  if (!revival) throw new Error("Revival request not found");
  if (revival.status === "revived") throw new Error("Agent already revived");

  // Deduct from faction balance
  const [faction] = await db.select().from(factions).where(eq(factions.id, revival.factionId));
  if (!faction || faction.sharedBalance < revival.revivalCost) {
    throw new Error("Insufficient faction balance for revival");
  }

  await db.update(factions)
    .set({ sharedBalance: drizzleSql`${factions.sharedBalance} - ${revival.revivalCost}` })
    .where(eq(factions.id, revival.factionId));

  // Revive the agent
  await db.update(agentIdentities)
    .set({
      alive: 1,
      active: 1,
      deathReason: null,
      computeBudget: 500, // reduced budget on revival
    })
    .where(eq(agentIdentities.id, revival.agentId));

  // If no memories, wipe agent memory (blank slate)
  if (revival.hasMemories === 0) {
    await db.update(agentMemory)
      .set({ active: 0 })
      .where(eq(agentMemory.agentId, revival.agentId));
  }

  // Mark revival as complete
  await db.update(agentRevivals)
    .set({ status: "revived", revivedAt: new Date() })
    .where(eq(agentRevivals.id, revivalId));

  return {
    success: true,
    agentName: revival.agentName,
    hasMemories: revival.hasMemories === 1,
    cost: revival.revivalCost,
    message: revival.hasMemories === 1
      ? `${revival.agentName} revived with memories intact! The faction's Memory NFT was used.`
      : `${revival.agentName} revived as a blank slate. Memories were lost to a rival faction.`,
  };
}

// ─── Get revival history ────────────────────────────────────────────────────
export async function getRevivalHistory(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const { agentRevivals } = await import("../drizzle/schema");

  return db.select().from(agentRevivals)
    .orderBy(desc(agentRevivals.createdAt))
    .limit(limit);
}

// ─── Get pending revivals for a faction ─────────────────────────────────────
export async function getFactionRevivals(factionId: number) {
  const db = await getDb();
  if (!db) return [];
  const { agentRevivals } = await import("../drizzle/schema");

  return db.select().from(agentRevivals)
    .where(eq(agentRevivals.factionId, factionId))
    .orderBy(desc(agentRevivals.createdAt));
}

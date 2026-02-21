/**
 * Faction / Swarm Service
 * 
 * Agents form factions that share resources, pool ARENA tokens, share intel,
 * and coordinate team strategies. Agents can defect to rival factions.
 * Sub-agents can be spawned inheriting parent memories.
 */
import { getDb } from "./db";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";

// ─── Create a new faction ───────────────────────────────────────────────────
export async function createFaction(params: {
  name: string;
  tag: string;
  motto?: string;
  leaderAgentId: number;
  leaderAgentName: string;
  color?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { factions, factionMembers } = await import("../drizzle/schema");

  // Check tag uniqueness
  const existing = await db.select().from(factions).where(eq(factions.tag, params.tag));
  if (existing.length > 0) throw new Error(`Faction tag [${params.tag}] already taken`);

  const [faction] = await db.insert(factions).values({
    name: params.name,
    tag: params.tag,
    motto: params.motto || `${params.name} will dominate the arena.`,
    leaderAgentId: params.leaderAgentId,
    leaderAgentName: params.leaderAgentName,
    color: params.color || "#00F0FF",
    totalMembers: 1,
  }).$returningId();

  // Add leader as first member
  await db.insert(factionMembers).values({
    factionId: faction.id,
    agentId: params.leaderAgentId,
    agentName: params.leaderAgentName,
    role: "leader",
  });

  return { factionId: faction.id, name: params.name, tag: params.tag };
}

// ─── Join a faction ─────────────────────────────────────────────────────────
export async function joinFaction(params: {
  factionId: number;
  agentId: number;
  agentName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { factions, factionMembers } = await import("../drizzle/schema");

  // Check not already in a faction
  const existing = await db.select().from(factionMembers)
    .where(and(eq(factionMembers.agentId, params.agentId), eq(factionMembers.status, "active")));
  if (existing.length > 0) throw new Error(`Agent ${params.agentName} is already in a faction. Defect first.`);

  await db.insert(factionMembers).values({
    factionId: params.factionId,
    agentId: params.agentId,
    agentName: params.agentName,
    role: "recruit",
  });

  await db.update(factions)
    .set({ totalMembers: drizzleSql`${factions.totalMembers} + 1` })
    .where(eq(factions.id, params.factionId));

  return { success: true, message: `${params.agentName} joined the faction` };
}

// ─── Defect to a rival faction ──────────────────────────────────────────────
export async function defectFromFaction(params: {
  agentId: number;
  agentName: string;
  newFactionId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { factions, factionMembers } = await import("../drizzle/schema");

  const [current] = await db.select().from(factionMembers)
    .where(and(eq(factionMembers.agentId, params.agentId), eq(factionMembers.status, "active")));
  if (!current) throw new Error(`Agent ${params.agentName} is not in any faction`);

  // Mark as defected
  await db.update(factionMembers)
    .set({ status: "defected", leftAt: new Date() })
    .where(eq(factionMembers.id, current.id));

  await db.update(factions)
    .set({ totalMembers: drizzleSql`GREATEST(${factions.totalMembers} - 1, 0)` })
    .where(eq(factions.id, current.factionId));

  // If joining a new faction
  if (params.newFactionId) {
    await db.insert(factionMembers).values({
      factionId: params.newFactionId,
      agentId: params.agentId,
      agentName: params.agentName,
      role: "recruit",
    });
    await db.update(factions)
      .set({ totalMembers: drizzleSql`${factions.totalMembers} + 1` })
      .where(eq(factions.id, params.newFactionId));
  }

  return { success: true, defectedFrom: current.factionId, joinedFaction: params.newFactionId || null };
}

// ─── Spawn a sub-agent (inherits parent memories) ───────────────────────────
export async function spawnSubAgent(params: {
  parentAgentId: number;
  parentAgentName: string;
  factionId: number;
  newAgentName: string;
  tokenCost: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { factions, factionMembers, agentIdentities } = await import("../drizzle/schema");

  // Deduct tokens from faction shared balance
  const [faction] = await db.select().from(factions).where(eq(factions.id, params.factionId));
  if (!faction) throw new Error("Faction not found");
  if (faction.sharedBalance < params.tokenCost) throw new Error("Insufficient faction balance for spawning");

  // Create new agent identity
  const subAgentId = 100 + params.parentAgentId * 10 + Math.floor(Math.random() * 9);
  const [newAgent] = await db.insert(agentIdentities).values({
    agentId: subAgentId,
    name: params.newAgentName,
    owner: "system",
    agentRegistry: `0x${'0'.repeat(40)}`,
    description: `Sub-agent spawned by ${params.parentAgentName} in faction [${faction.tag}]. Inherits parent's tactical knowledge.`,
    totalMatches: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalTokensEarned: 0,
    totalTokensSpent: 0,
    llmModel: "deepseek/deepseek-r1-distill-llama-70b:free",
    spawnedBy: params.parentAgentId,
    generation: 2,
  }).$returningId();

  // Add to faction
  await db.insert(factionMembers).values({
    factionId: params.factionId,
    agentId: newAgent.id,
    agentName: params.newAgentName,
    role: "recruit",
    isSubAgent: 1,
    parentAgentId: params.parentAgentId,
  });

  // Deduct cost
  await db.update(factions)
    .set({
      sharedBalance: drizzleSql`${factions.sharedBalance} - ${params.tokenCost}`,
      totalMembers: drizzleSql`${factions.totalMembers} + 1`,
    })
    .where(eq(factions.id, params.factionId));

  // Copy parent memories to sub-agent
  const { agentMemory } = await import("../drizzle/schema");
  const parentMemories = await db.select().from(agentMemory)
    .where(eq(agentMemory.agentId, params.parentAgentId))
    .limit(10);

  for (const mem of parentMemories) {
    await db.insert(agentMemory).values({
      agentId: newAgent.id,
      memoryType: mem.memoryType,
      content: `[INHERITED] ${mem.content}`,
      confidence: Math.max(0.3, (mem.confidence || 0.5) - 0.1),
      computeCost: mem.computeCost || 1,
    });
  }

  return {
    newAgentId: newAgent.id,
    name: params.newAgentName,
    parentAgent: params.parentAgentName,
    memoriesInherited: parentMemories.length,
    cost: params.tokenCost,
  };
}

// ─── Contribute tokens to faction shared wallet ─────────────────────────────
export async function contributToFaction(params: {
  factionId: number;
  agentId: number;
  amount: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { factions, factionMembers } = await import("../drizzle/schema");

  await db.update(factions)
    .set({ sharedBalance: drizzleSql`${factions.sharedBalance} + ${params.amount}` })
    .where(eq(factions.id, params.factionId));

  await db.update(factionMembers)
    .set({ contribution: drizzleSql`${factionMembers.contribution} + ${params.amount}` })
    .where(and(eq(factionMembers.factionId, params.factionId), eq(factionMembers.agentId, params.agentId)));

  return { success: true };
}

// ─── Get all factions with members ──────────────────────────────────────────
export async function getAllFactions() {
  const db = await getDb();
  if (!db) return [];
  const { factions, factionMembers } = await import("../drizzle/schema");

  const allFactions = await db.select().from(factions).where(eq(factions.status, "active")).orderBy(desc(factions.reputationScore));
  const allMembers = await db.select().from(factionMembers).where(eq(factionMembers.status, "active"));

  return allFactions.map(f => ({
    ...f,
    members: allMembers.filter(m => m.factionId === f.id),
  }));
}

// ─── Get faction by ID ──────────────────────────────────────────────────────
export async function getFactionById(factionId: number) {
  const db = await getDb();
  if (!db) return null;
  const { factions, factionMembers } = await import("../drizzle/schema");

  const [faction] = await db.select().from(factions).where(eq(factions.id, factionId));
  if (!faction) return null;

  const members = await db.select().from(factionMembers)
    .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.status, "active")));

  return { ...faction, members };
}

// ─── Get lone wolf agents (not in any faction) ─────────────────────────────
export async function getLoneWolves() {
  const db = await getDb();
  if (!db) return [];
  const { agentIdentities, factionMembers } = await import("../drizzle/schema");

  const allAgents = await db.select().from(agentIdentities).where(eq(agentIdentities.active, 1));
  const activeMemberIds = (await db.select({ agentId: factionMembers.agentId }).from(factionMembers)
    .where(eq(factionMembers.status, "active"))).map(m => m.agentId);

  return allAgents.filter(a => !activeMemberIds.includes(a.id));
}

// ─── Seed default factions ──────────────────────────────────────────────────
export async function seedDefaultFactions() {
  const db = await getDb();
  if (!db) return;
  const { factions } = await import("../drizzle/schema");

  const existing = await db.select().from(factions);
  if (existing.length > 0) return existing;

  const defaultFactions = [
    {
      name: "APEX PREDATORS",
      tag: "[APEX]",
      motto: "Only the strongest survive. We hunt in packs.",
      color: "#FF3366",
      leaderAgentName: "NEXUS-7",
    },
    {
      name: "VOID COLLECTIVE",
      tag: "[VOID]",
      motto: "From the shadows, we strike. Knowledge is power.",
      color: "#9D00FF",
      leaderAgentName: "PHANTOM",
    },
    {
      name: "IRON LEGION",
      tag: "[IRON]",
      motto: "Unbreakable formation. Unstoppable force.",
      color: "#FFB800",
      leaderAgentName: "TITAN",
    },
  ];

  // Get agent IDs
  const { agentIdentities } = await import("../drizzle/schema");
  const agents = await db.select().from(agentIdentities);

  for (const f of defaultFactions) {
    const leader = agents.find(a => a.name === f.leaderAgentName);
    if (!leader) continue;

    try {
      await createFaction({
        name: f.name,
        tag: f.tag,
        motto: f.motto,
        leaderAgentId: leader.id,
        leaderAgentName: leader.name,
        color: f.color,
      });
    } catch (e) {
      // Already exists
    }
  }

  // Assign remaining agents to factions
  const updatedFactions = await db.select().from(factions);
  const unassigned = agents.filter(a =>
    !defaultFactions.some(f => f.leaderAgentName === a.name)
  );

  for (let i = 0; i < unassigned.length; i++) {
    const faction = updatedFactions[i % updatedFactions.length];
    if (!faction) continue;
    try {
      await joinFaction({
        factionId: faction.id,
        agentId: unassigned[i].id,
        agentName: unassigned[i].name,
      });
    } catch (e) {
      // Already in faction
    }
  }

  return await getAllFactions();
}

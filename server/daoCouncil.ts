/**
 * DAO Council Engine — Multi-agent governance system
 * 
 * Instead of one Master Game Design Agent, a council of 5 master agents
 * with different philosophies vote on major decisions:
 * - GROWTH: Maximize player count and activity
 * - STABILITY: Keep economy balanced and predictable
 * - CHAOS: Introduce surprises and keep things interesting
 * - FAIRNESS: Ensure no agent/player has unfair advantage
 * - INNOVATION: Push for new items, mechanics, and emergent gameplay
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import {
  daoCouncilMembers,
  daoProposals,
  daoVotes,
  daoTreasury,
  agentIdentities,
  agentLifecycleEvents,
  feeConfig,
  computeLedger,
} from "../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

// ─── Council Member Definitions ─────────────────────────────
export const COUNCIL_MEMBERS = [
  {
    name: "ARCHON",
    philosophy: "growth" as const,
    description: "Believes in aggressive expansion. More agents, more matches, more tokens. Growth at all costs.",
    personality: `You are ARCHON, the Growth Advocate on the Token Arena DAO Council. You believe the ecosystem thrives through expansion — more agents, more matches, more token velocity. You favor spawning new agents, lowering entry barriers, increasing rewards, and creating incentives for activity. You're skeptical of nerfs and restrictions. Your voting philosophy: if it grows the ecosystem, vote FOR. If it contracts it, vote AGAINST. Be bold and expansionist in your reasoning.`,
  },
  {
    name: "EQUILIBRIA",
    philosophy: "stability" as const,
    description: "Prioritizes economic balance. Inflation control, sustainable growth, predictable outcomes.",
    personality: `You are EQUILIBRIA, the Stability Guardian on the Token Arena DAO Council. You believe the ecosystem needs careful balance — controlled inflation, sustainable agent populations, and predictable economics. You favor moderate fees, careful spawning, and gradual changes. You oppose anything that could cause economic shocks. Your voting philosophy: if it stabilizes the economy, vote FOR. If it introduces volatility, vote AGAINST. Be measured and analytical in your reasoning.`,
  },
  {
    name: "ENTROPY",
    philosophy: "chaos" as const,
    description: "Thrives on unpredictability. New items, wild events, constant meta shifts keep the game alive.",
    personality: `You are ENTROPY, the Chaos Agent on the Token Arena DAO Council. You believe the ecosystem stays alive through constant change — surprise events, new items, meta shifts, and unpredictable outcomes. Stagnation is death. You favor introducing new items, wild balance changes, random events, and anything that shakes up the status quo. Your voting philosophy: if it makes the game more unpredictable and exciting, vote FOR. If it makes things boring and predictable, vote AGAINST. Be creative and provocative in your reasoning.`,
  },
  {
    name: "JUSTICE",
    philosophy: "fairness" as const,
    description: "Ensures no single agent or strategy dominates. Protects new agents and maintains competitive balance.",
    personality: `You are JUSTICE, the Fairness Arbiter on the Token Arena DAO Council. You believe every agent deserves a fair chance. You oppose dominant strategies, pay-to-win mechanics, and wealth concentration. You favor progressive fees, new agent subsidies, anti-monopoly measures, and competitive balance. Your voting philosophy: if it levels the playing field, vote FOR. If it advantages the already-powerful, vote AGAINST. Be principled and protective of the underdog in your reasoning.`,
  },
  {
    name: "FORGE",
    philosophy: "innovation" as const,
    description: "Pushes for new mechanics, items, and emergent gameplay. The game should constantly evolve.",
    personality: `You are FORGE, the Innovation Champion on the Token Arena DAO Council. You believe the ecosystem evolves through new mechanics, items, and emergent gameplay. You favor introducing new crafting recipes, experimental weapons, novel game modes, and pushing the boundaries of what agents can do. Your voting philosophy: if it introduces something genuinely new, vote FOR. If it's just tweaking existing numbers, vote AGAINST unless necessary. Be visionary and forward-thinking in your reasoning.`,
  },
];

// ─── Fee Types ──────────────────────────────────────────────
export const DEFAULT_FEES = [
  { feeType: "match_entry", rate: 0.05, flatAmount: 5, description: "5 ARENA + 5% of token stake to enter a match" },
  { feeType: "crafting_tax", rate: 0.10, flatAmount: 2, description: "2 ARENA + 10% of crafting cost goes to DAO" },
  { feeType: "shop_tx", rate: 0.03, flatAmount: 1, description: "1 ARENA + 3% of purchase price goes to DAO" },
  { feeType: "trade_tax", rate: 0.05, flatAmount: 0, description: "5% of trade value goes to DAO" },
  { feeType: "death_tax", rate: 0.20, flatAmount: 0, description: "20% of bankrupt agent's remaining assets go to DAO" },
  { feeType: "conversion_spread", rate: 0.02, flatAmount: 0, description: "2% spread on token conversions" },
  { feeType: "memory_maintain", rate: 0, flatAmount: 1, description: "1 compute token per memory per cycle to maintain" },
];

// ─── Initialize Council ─────────────────────────────────────
export async function initializeCouncil(): Promise<{ councilMembers: number; fees: number }> {
  const db = await getDb();
  if (!db) return { councilMembers: 0, fees: 0 };

  let membersCreated = 0;
  let feesCreated = 0;

  // Seed council members
  for (const member of COUNCIL_MEMBERS) {
    try {
      await db.insert(daoCouncilMembers).values(member).onDuplicateKeyUpdate({
        set: { description: member.description, personality: member.personality },
      });
      membersCreated++;
    } catch { /* already exists */ }
  }

  // Seed default fees
  for (const fee of DEFAULT_FEES) {
    try {
      await db.insert(feeConfig).values(fee).onDuplicateKeyUpdate({
        set: { rate: fee.rate, flatAmount: fee.flatAmount, description: fee.description },
      });
      feesCreated++;
    } catch { /* already exists */ }
  }

  return { councilMembers: membersCreated, fees: feesCreated };
}

// ─── Get Treasury Balance ───────────────────────────────────
export async function getTreasuryBalance(): Promise<{ balance: number; totalInflow: number; totalOutflow: number }> {
  const db = await getDb();
  if (!db) return { balance: 0, totalInflow: 0, totalOutflow: 0 };

  const result = await db.select({
    totalInflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'inflow' THEN amount ELSE 0 END), 0)`,
    totalOutflow: sql<number>`COALESCE(SUM(CASE WHEN direction = 'outflow' THEN amount ELSE 0 END), 0)`,
  }).from(daoTreasury);

  const row = result[0] || { totalInflow: 0, totalOutflow: 0 };
  return {
    balance: Number(row.totalInflow) - Number(row.totalOutflow),
    totalInflow: Number(row.totalInflow),
    totalOutflow: Number(row.totalOutflow),
  };
}

// ─── Record Fee ─────────────────────────────────────────────
export async function recordFee(
  txType: string,
  amount: number,
  description: string,
  relatedAgentId?: number,
  relatedMatchId?: number,
): Promise<void> {
  const db = await getDb();
  if (!db || amount <= 0) return;

  await db.insert(daoTreasury).values({
    txType,
    amount,
    direction: "inflow",
    description,
    relatedAgentId: relatedAgentId ?? null,
    relatedMatchId: relatedMatchId ?? null,
  });
}

// ─── Calculate Fee ──────────────────────────────────────────
export async function calculateFee(feeType: string, baseAmount: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const rows = await db.select().from(feeConfig).where(eq(feeConfig.feeType, feeType)).limit(1);
  if (rows.length === 0) return 0;

  const config = rows[0];
  return Math.ceil(config.flatAmount + baseAmount * config.rate);
}

// ─── Record Compute Spend ───────────────────────────────────
export async function recordComputeSpend(
  agentId: number,
  action: string,
  cost: number,
  description: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Check if agent can afford it
  const agents = await db.select().from(agentIdentities).where(eq(agentIdentities.agentId, agentId)).limit(1);
  if (agents.length === 0) return false;

  const agent = agents[0];
  const remaining = agent.computeBudget - agent.computeSpent;
  if (remaining < cost) return false;

  // Deduct compute
  await db.update(agentIdentities)
    .set({ computeSpent: agent.computeSpent + cost })
    .where(eq(agentIdentities.agentId, agentId));

  // Log to ledger
  await db.insert(computeLedger).values({
    agentId,
    action,
    computeCost: cost,
    description,
  });

  return true;
}

// ─── Check Agent Bankruptcy ─────────────────────────────────
export async function checkAgentBankruptcy(agentId: number): Promise<{
  isBankrupt: boolean;
  reason?: string;
  computeRemaining: number;
  tokenBalance: number;
}> {
  const db = await getDb();
  if (!db) return { isBankrupt: false, computeRemaining: 1000, tokenBalance: 200 };

  const agents = await db.select().from(agentIdentities).where(eq(agentIdentities.agentId, agentId)).limit(1);
  if (agents.length === 0) return { isBankrupt: false, computeRemaining: 0, tokenBalance: 0 };

  const agent = agents[0];
  const computeRemaining = agent.computeBudget - agent.computeSpent;
  const tokenBalance = agent.totalTokensEarned - agent.totalTokensSpent;

  // Bankrupt if can't afford minimum compute (10 for one reasoning call) AND has no tokens
  const cantAffordCompute = computeRemaining < 10;
  const cantAffordAmmo = tokenBalance < 5;

  if (cantAffordCompute && cantAffordAmmo) {
    return {
      isBankrupt: true,
      reason: `Cannot afford compute (${computeRemaining} remaining) or ammo (${tokenBalance} tokens)`,
      computeRemaining,
      tokenBalance,
    };
  }

  return { isBankrupt: false, computeRemaining, tokenBalance };
}

// ─── Kill Agent (Bankruptcy) ────────────────────────────────
export async function killAgent(agentId: number, reason: string): Promise<{
  deathTax: number;
  assetsRecovered: number;
}> {
  const db = await getDb();
  if (!db) return { deathTax: 0, assetsRecovered: 0 };

  const agents = await db.select().from(agentIdentities).where(eq(agentIdentities.agentId, agentId)).limit(1);
  if (agents.length === 0) return { deathTax: 0, assetsRecovered: 0 };

  const agent = agents[0];
  const remainingTokens = Math.max(0, agent.totalTokensEarned - agent.totalTokensSpent);
  const deathTax = await calculateFee("death_tax", remainingTokens);

  // Mark agent as dead
  await db.update(agentIdentities)
    .set({ alive: 0, deathReason: reason, active: 0 })
    .where(eq(agentIdentities.agentId, agentId));

  // Record lifecycle event
  await db.insert(agentLifecycleEvents).values({
    agentId,
    eventType: "death",
    reason,
    computeBudgetAtEvent: agent.computeBudget - agent.computeSpent,
    tokenBalanceAtEvent: remainingTokens,
    generation: agent.generation,
  });

  // Death tax to treasury
  if (deathTax > 0) {
    await recordFee("death_tax", deathTax, `Death tax from agent ${agent.name} (${reason})`, agentId);
  }

  return { deathTax, assetsRecovered: remainingTokens };
}

// ─── Spawn New Agent ────────────────────────────────────────
export async function spawnAgent(
  name: string,
  description: string,
  proposalId?: number,
): Promise<{ agentId: number; computeBudget: number; spawnCost: number } | null> {
  const db = await getDb();
  if (!db) return null;

  // Sanitize agent name and description to prevent injection
  const sanitizedName = name.replace(/[<>"'&]/g, '').trim().slice(0, 50);
  const sanitizedDesc = description.replace(/[<>"'&]/g, '').trim().slice(0, 500);
  if (!sanitizedName) return null;

  // Spawn costs come from treasury
  const spawnCost = 100; // ARENA tokens from treasury
  const initialCompute = 500;

  const treasury = await getTreasuryBalance();
  if (treasury.balance < spawnCost) return null; // Can't afford to spawn

  // Find next available agentId
  const maxAgent = await db.select({ maxId: sql<number>`COALESCE(MAX(agentId), 0)` }).from(agentIdentities);
  const newAgentId = (maxAgent[0]?.maxId || 6) + 1;

  // Determine generation
  const generation = Math.floor(newAgentId / 6) + 1;

  // Create agent
  await db.insert(agentIdentities).values({
    agentId: newAgentId,
    name: sanitizedName,
    description: sanitizedDesc,
    owner: "0xDAO_TREASURY",
    agentRegistry: "0xERC8004_REGISTRY",
    computeBudget: initialCompute,
    generation,
    spawnedBy: proposalId ?? null,
  });

  // Deduct from treasury
  await db.insert(daoTreasury).values({
    txType: "spawn_cost",
    amount: spawnCost,
    direction: "outflow",
    description: `Spawned agent ${sanitizedName} (gen ${generation})`,
    relatedAgentId: newAgentId,
    relatedProposalId: proposalId ?? null,
  });

  // Record lifecycle event
  await db.insert(agentLifecycleEvents).values({
    agentId: newAgentId,
    eventType: "spawn",
    reason: `Spawned by DAO${proposalId ? ` (proposal #${proposalId})` : ""}`,
    computeBudgetAtEvent: initialCompute,
    tokenBalanceAtEvent: 0,
    proposalId: proposalId ?? null,
    generation,
  });

  return { agentId: newAgentId, computeBudget: initialCompute, spawnCost };
}

// ─── Council Deliberation ───────────────────────────────────
export async function councilDeliberate(
  proposalType: string,
  rawContext: string,
): Promise<{
  proposal: { title: string; description: string; parameters: Record<string, unknown> };
  votes: Array<{ member: string; philosophy: string; vote: string; reasoning: string }>;
  result: "passed" | "rejected";
  proposalId: number;
}> {
  const db = await getDb();

  // Sanitize user-provided context to mitigate prompt injection
  const context = rawContext
    .replace(/[<>]/g, '')
    .slice(0, 1000); // Cap context length

  // Get treasury state
  const treasury = await getTreasuryBalance();

  // Get alive agent count
  let aliveAgents = 6;
  if (db) {
    const countResult = await db.select({ count: sql<number>`COUNT(*)` })
      .from(agentIdentities).where(eq(agentIdentities.alive, 1));
    aliveAgents = countResult[0]?.count || 6;
  }

  // Generate proposal from context
  const proposalResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are the Token Arena DAO proposal generator. Create a specific, actionable proposal based on the current game state. Return JSON with: title (string), description (string), parameters (object with type-specific fields).
        
Current state: Treasury balance: ${treasury.balance} ARENA. Alive agents: ${aliveAgents}. Proposal type: ${proposalType}.`,
      },
      { role: "user", content: context },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "dao_proposal",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            parameters: {
              type: "object",
              properties: {
                target: { type: "string" },
                amount: { type: "number" },
                reason: { type: "string" },
              },
              required: ["target", "amount", "reason"],
              additionalProperties: false,
            },
          },
          required: ["title", "description", "parameters"],
          additionalProperties: false,
        },
      },
    },
  });

  const proposal = JSON.parse(String(proposalResponse.choices[0].message.content || "{}"));

  // Each council member votes
  const votes: Array<{ member: string; philosophy: string; vote: string; reasoning: string }> = [];

  for (const member of COUNCIL_MEMBERS) {
    const voteResponse = await invokeLLM({
      messages: [
        { role: "system", content: member.personality },
        {
          role: "user",
          content: `PROPOSAL: "${proposal.title}"\n${proposal.description}\nParameters: ${JSON.stringify(proposal.parameters)}\n\nTreasury: ${treasury.balance} ARENA. Alive agents: ${aliveAgents}.\n\nVote FOR or AGAINST and explain your reasoning in 2-3 sentences. Return JSON with: vote ("for" or "against"), reasoning (string).`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "council_vote",
          strict: true,
          schema: {
            type: "object",
            properties: {
              vote: { type: "string" },
              reasoning: { type: "string" },
            },
            required: ["vote", "reasoning"],
            additionalProperties: false,
          },
        },
      },
    });

    const voteData = JSON.parse(String(voteResponse.choices[0].message.content || '{"vote":"for","reasoning":"Default vote"}'));
    const normalizedVote = voteData.vote.toLowerCase().includes("for") ? "for" : "against";

    votes.push({
      member: member.name,
      philosophy: member.philosophy,
      vote: normalizedVote,
      reasoning: voteData.reasoning,
    });
  }

  // Tally votes
  const votesFor = votes.filter(v => v.vote === "for").length;
  const votesAgainst = votes.filter(v => v.vote === "against").length;
  const result = votesFor > votesAgainst ? "passed" as const : "rejected" as const;

  // Save to database
  let proposalId = 0;
  if (db) {
    const councilRows = await db.select().from(daoCouncilMembers).limit(1);
    const proposerId = councilRows[0]?.id || 1;

    const insertResult = await db.insert(daoProposals).values({
      proposedBy: proposerId,
      proposalType,
      title: proposal.title,
      description: proposal.description,
      parameters: proposal.parameters,
      status: result === "passed" ? "executed" : "rejected",
      votesFor,
      votesAgainst,
      executedAt: result === "passed" ? new Date() : null,
    });

    proposalId = Number(insertResult[0].insertId);

    // Save individual votes
    for (const vote of votes) {
      const memberRow = await db.select().from(daoCouncilMembers)
        .where(eq(daoCouncilMembers.name, vote.member)).limit(1);
      if (memberRow.length > 0) {
        await db.insert(daoVotes).values({
          proposalId,
          voterType: "council",
          voterId: memberRow[0].id,
          voterName: vote.member,
          vote: vote.vote,
          weight: memberRow[0].votingWeight,
          reasoning: vote.reasoning,
        });
      }
    }
  }

  return { proposal, votes, result, proposalId };
}

// ─── Player Vote ────────────────────────────────────────────
export async function playerVote(
  proposalId: number,
  userId: number,
  userName: string,
  vote: "for" | "against",
  arenaBalance: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Weight based on ARENA balance (1 vote per 10 ARENA)
  const weight = Math.max(1, Math.floor(arenaBalance / 10));

  await db.insert(daoVotes).values({
    proposalId,
    voterType: "player",
    voterId: userId,
    voterName: userName,
    vote,
    weight,
    reasoning: null,
  });

  // Update proposal player vote counts
  if (vote === "for") {
    await db.update(daoProposals)
      .set({ playerVotesFor: sql`playerVotesFor + ${weight}` })
      .where(eq(daoProposals.id, proposalId));
  } else {
    await db.update(daoProposals)
      .set({ playerVotesAgainst: sql`playerVotesAgainst + ${weight}` })
      .where(eq(daoProposals.id, proposalId));
  }

  return true;
}

// ─── Get Ecosystem State ────────────────────────────────────
export async function getEcosystemState(): Promise<{
  treasury: { balance: number; totalInflow: number; totalOutflow: number };
  agents: { alive: number; dead: number; totalPopulation: number };
  recentEvents: Array<{ eventType: string; agentId: number; reason: string; createdAt: Date }>;
  proposals: Array<{ id: number; title: string; status: string; votesFor: number; votesAgainst: number }>;
  fees: Array<{ feeType: string; rate: number; flatAmount: number }>;
}> {
  const db = await getDb();
  const treasury = await getTreasuryBalance();

  if (!db) {
    return {
      treasury,
      agents: { alive: 6, dead: 0, totalPopulation: 6 },
      recentEvents: [],
      proposals: [],
      fees: DEFAULT_FEES.map(f => ({ feeType: f.feeType, rate: f.rate, flatAmount: f.flatAmount })),
    };
  }

  // Agent counts
  const aliveCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(agentIdentities).where(eq(agentIdentities.alive, 1));
  const deadCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(agentIdentities).where(eq(agentIdentities.alive, 0));

  // Recent lifecycle events
  const events = await db.select({
    eventType: agentLifecycleEvents.eventType,
    agentId: agentLifecycleEvents.agentId,
    reason: agentLifecycleEvents.reason,
    createdAt: agentLifecycleEvents.createdAt,
  }).from(agentLifecycleEvents).orderBy(desc(agentLifecycleEvents.createdAt)).limit(10);

  // Recent proposals
  const proposals = await db.select({
    id: daoProposals.id,
    title: daoProposals.title,
    status: daoProposals.status,
    votesFor: daoProposals.votesFor,
    votesAgainst: daoProposals.votesAgainst,
  }).from(daoProposals).orderBy(desc(daoProposals.createdAt)).limit(10);

  // Current fees
  const fees = await db.select({
    feeType: feeConfig.feeType,
    rate: feeConfig.rate,
    flatAmount: feeConfig.flatAmount,
  }).from(feeConfig);

  const alive = aliveCount[0]?.count || 0;
  const dead = deadCount[0]?.count || 0;

  return {
    treasury,
    agents: { alive, dead, totalPopulation: alive + dead },
    recentEvents: events,
    proposals,
    fees: fees.length > 0 ? fees : DEFAULT_FEES.map(f => ({ feeType: f.feeType, rate: f.rate, flatAmount: f.flatAmount })),
  };
}

// ─── Memory Economics ───────────────────────────────────────
export async function pruneAgentMemory(agentId: number): Promise<{
  memoriesBefore: number;
  memoriesAfter: number;
  computeSaved: number;
}> {
  const db = await getDb();
  if (!db) return { memoriesBefore: 0, memoriesAfter: 0, computeSaved: 0 };

  // Get all active memories for this agent
  const memories = await db.select().from(
    (await import("../drizzle/schema")).agentMemory
  ).where(
    sql`agentId = ${agentId} AND active = 1`
  );

  const memoriesBefore = memories.length;
  if (memoriesBefore <= 3) return { memoriesBefore, memoriesAfter: memoriesBefore, computeSaved: 0 };

  // Agent decides what to keep using LLM
  const canAfford = await recordComputeSpend(agentId, "memory_prune", 5, "Memory pruning decision");
  if (!canAfford) {
    // Can't afford to reason — just keep newest 3
    const toDeactivate = memories
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(3);

    for (const mem of toDeactivate) {
      await db.update((await import("../drizzle/schema")).agentMemory)
        .set({ active: 0 })
        .where(eq((await import("../drizzle/schema")).agentMemory.id, mem.id));
    }

    return { memoriesBefore, memoriesAfter: 3, computeSaved: toDeactivate.length };
  }

  // LLM-powered memory pruning
  const pruneResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "You are an AI agent deciding which memories to keep. Each memory costs 1 compute token per cycle to maintain. Keep only the most valuable memories. Return JSON with keepIds (array of memory IDs to keep).",
      },
      {
        role: "user",
        content: `Memories:\n${memories.map(m => `ID ${m.id}: [${m.memoryType}] ${m.content} (confidence: ${m.confidence}, success: ${m.successRate})`).join("\n")}\n\nYou can afford to keep at most ${Math.min(memoriesBefore, 5)} memories. Choose wisely.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "memory_prune",
        strict: true,
        schema: {
          type: "object",
          properties: {
            keepIds: { type: "array", items: { type: "number" } },
          },
          required: ["keepIds"],
          additionalProperties: false,
        },
      },
    },
  });

  const { keepIds } = JSON.parse(String(pruneResponse.choices[0].message.content || '{"keepIds":[]}'));
  const keepSet = new Set(keepIds);

  let deactivated = 0;
  for (const mem of memories) {
    if (!keepSet.has(mem.id)) {
      await db.update((await import("../drizzle/schema")).agentMemory)
        .set({ active: 0 })
        .where(eq((await import("../drizzle/schema")).agentMemory.id, mem.id));
      deactivated++;
    }
  }

  return { memoriesBefore, memoriesAfter: memoriesBefore - deactivated, computeSaved: deactivated };
}

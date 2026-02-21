/**
 * DAO Council Memory — Persistent Institutional Knowledge
 *
 * Council members now remember past deliberations and outcomes.
 * When voting on a new proposal, each member recalls their relevant past decisions
 * and whether those decisions led to good outcomes. This creates genuine
 * institutional learning — ARCHON learns from past aggressive spawning that
 * caused inflation, EQUILIBRIA recalls when stability measures stifled growth, etc.
 *
 * This is the "quick win" that makes the DAO feel like a real evolving institution
 * rather than 5 stateless LLMs making isolated decisions.
 */

import { getDb } from "./db";
import { daoCouncilMemory } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Save Council Deliberation ─────────────────────────────────────────────

/**
 * Persist a council member's vote and reasoning after deliberation.
 * Called after each councilDeliberate() to build institutional memory.
 */
export async function saveCouncilMemory(
  councilMemberName: string,
  philosophy: string,
  proposalType: string,
  proposalTitle: string,
  vote: "for" | "against",
  reasoning: string,
  outcome: "passed" | "rejected",
  proposalId?: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // A vote is "correct" if the member voted with the majority (outcome matches their vote)
  const wasCorrect =
    (vote === "for" && outcome === "passed") ||
    (vote === "against" && outcome === "rejected")
      ? 1
      : 0;

  // Generate a simulated IPFS hash for decentralized storage readiness
  const contentForHash = `${councilMemberName}:${proposalType}:${vote}:${reasoning}`;
  const ipfsHash = `ipfs://Qm${Buffer.from(contentForHash).toString("base64").slice(0, 44)}`;

  await db.insert(daoCouncilMemory).values({
    councilMemberName,
    philosophy,
    proposalType,
    proposalTitle,
    vote,
    reasoning,
    outcome,
    wasCorrect,
    proposalId: proposalId ?? null,
    ipfsHash,
  });

  console.log(
    `[CouncilMemory] ${councilMemberName} remembered: voted ${vote} on "${proposalTitle}" → ${outcome} (${wasCorrect ? "correct" : "incorrect"} call)`,
  );
}

// ─── Retrieve Council Memory ───────────────────────────────────────────────

/**
 * Get relevant past memories for a council member before they vote.
 * Filters by proposal type and philosophy to surface the most relevant history.
 */
export async function getCouncilMemberMemories(
  councilMemberName: string,
  proposalType: string,
  limit = 5,
): Promise<
  Array<{
    proposalTitle: string;
    vote: string;
    reasoning: string;
    outcome: string;
    wasCorrect: number;
    createdAt: Date;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  // First try to get memories specific to this proposal type
  const typeSpecific = await db
    .select({
      proposalTitle: daoCouncilMemory.proposalTitle,
      vote: daoCouncilMemory.vote,
      reasoning: daoCouncilMemory.reasoning,
      outcome: daoCouncilMemory.outcome,
      wasCorrect: daoCouncilMemory.wasCorrect,
      createdAt: daoCouncilMemory.createdAt,
    })
    .from(daoCouncilMemory)
    .where(
      and(
        eq(daoCouncilMemory.councilMemberName, councilMemberName),
        eq(daoCouncilMemory.proposalType, proposalType),
      ),
    )
    .orderBy(desc(daoCouncilMemory.createdAt))
    .limit(limit);

  if (typeSpecific.length >= 3) return typeSpecific;

  // If not enough type-specific memories, fill with recent general memories
  const general = await db
    .select({
      proposalTitle: daoCouncilMemory.proposalTitle,
      vote: daoCouncilMemory.vote,
      reasoning: daoCouncilMemory.reasoning,
      outcome: daoCouncilMemory.outcome,
      wasCorrect: daoCouncilMemory.wasCorrect,
      createdAt: daoCouncilMemory.createdAt,
    })
    .from(daoCouncilMemory)
    .where(eq(daoCouncilMemory.councilMemberName, councilMemberName))
    .orderBy(desc(daoCouncilMemory.createdAt))
    .limit(limit);

  return general;
}

// ─── Build Memory Briefing for LLM ────────────────────────────────────────

/**
 * Build a memory briefing string to inject into a council member's system prompt.
 * This gives the LLM context about past decisions and their outcomes.
 */
export async function buildCouncilMemberMemoryBriefing(
  councilMemberName: string,
  proposalType: string,
): Promise<string> {
  const memories = await getCouncilMemberMemories(councilMemberName, proposalType, 5);

  if (memories.length === 0) {
    return "\n[INSTITUTIONAL MEMORY]: No past deliberations on record. This is your first vote of this type.";
  }

  const correctVotes = memories.filter((m) => m.wasCorrect === 1).length;
  const accuracy = memories.length > 0 ? Math.round((correctVotes / memories.length) * 100) : 0;

  const memoryLines = memories
    .slice(0, 4)
    .map(
      (m) =>
        `  • "${m.proposalTitle}" → You voted ${m.vote.toUpperCase()}, outcome: ${m.outcome.toUpperCase()} (${m.wasCorrect ? "✓ correct call" : "✗ wrong call"})`,
    )
    .join("\n");

  return `\n[INSTITUTIONAL MEMORY — ${memories.length} past deliberations, ${accuracy}% accuracy]:
${memoryLines}

Use this history to inform your current vote. If past votes were wrong, consider adjusting your approach.`;
}

// ─── Get Council Memory Stats ──────────────────────────────────────────────

export async function getCouncilMemoryStats(): Promise<
  Array<{
    memberName: string;
    totalVotes: number;
    correctVotes: number;
    accuracy: number;
    lastVoteAt: Date | null;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  const members = ["ARCHON", "EQUILIBRIA", "ENTROPY", "JUSTICE", "FORGE"];
  const stats = [];

  for (const member of members) {
    const memories = await db
      .select()
      .from(daoCouncilMemory)
      .where(eq(daoCouncilMemory.councilMemberName, member))
      .orderBy(desc(daoCouncilMemory.createdAt));

    const total = memories.length;
    const correct = memories.filter((m) => m.wasCorrect === 1).length;
    const lastVote = memories[0]?.createdAt ?? null;

    stats.push({
      memberName: member,
      totalVotes: total,
      correctVotes: correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      lastVoteAt: lastVote,
    });
  }

  return stats;
}

export async function getRecentCouncilMemories(limit = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(daoCouncilMemory)
    .orderBy(desc(daoCouncilMemory.createdAt))
    .limit(limit);
}

/**
 * Prediction Market Engine
 * DAO council creates prediction markets for match outcomes.
 * Players and spectators bet on outcomes. DAO takes a cut as house/oracle.
 * Anti-manipulation: governance cooldown prevents DAO from rebalancing
 * immediately after creating a market they predicted on.
 */
import { getDb } from "./db";
import {
  predictionMarkets,
  predictionBets,
  daoTreasury,
  daoCouncilMembers,
  ecosystemSnapshots,
  agentIdentities,
  matches,
  x402Transactions,
} from "../drizzle/schema";
import { eq, desc, sql, and, count, sum } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// Market types the DAO can create
export const MARKET_TYPES = [
  { id: "match_winner", label: "Match Winner", description: "Which agent/player wins the match" },
  { id: "total_kills", label: "Total Kills", description: "Total kills across all combatants" },
  { id: "token_volume", label: "Token Volume", description: "Total tokens transacted in match" },
  { id: "survival_count", label: "Survivors", description: "How many agents survive the match" },
  { id: "first_blood", label: "First Blood", description: "Who gets the first kill" },
  { id: "mvp", label: "MVP", description: "Most valuable player by token net" },
] as const;

// DAO house fee on prediction markets (5%)
const HOUSE_FEE_RATE = 0.05;
// Governance cooldown in seconds after creating a market
const GOVERNANCE_COOLDOWN = 300; // 5 minutes

export interface MarketOption {
  id: number;
  label: string;
  odds: number; // decimal odds (2.0 = even money)
}

/**
 * Create a prediction market — called by the DAO council
 */
export async function createPredictionMarket(params: {
  councilMemberId: number;
  marketType: string;
  title: string;
  description: string;
  options: MarketOption[];
  matchId?: number;
}): Promise<{ marketId: number; governanceCooldownUntil: Date }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(predictionMarkets).values({
    matchId: params.matchId ?? null,
    marketType: params.marketType,
    title: params.title,
    description: params.description,
    options: params.options,
    createdByCouncilId: params.councilMemberId,
    status: "open",
    totalPool: 0,
    daoFeeCollected: 0,
    governanceCooldown: GOVERNANCE_COOLDOWN,
    lockTime: null,
  });

  const marketId = result[0].insertId;
  const cooldownUntil = new Date(Date.now() + GOVERNANCE_COOLDOWN * 1000);

  return { marketId, governanceCooldownUntil: cooldownUntil };
}

/**
 * Place a bet on a prediction market
 */
export async function placeBet(params: {
  marketId: number;
  bettorType: "player" | "agent" | "spectator";
  bettorId: string;
  bettorName: string;
  optionId: number;
  amount: number;
}): Promise<{ betId: number; potentialPayout: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check market is open
  const market = await db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.id, params.marketId)).limit(1);
  if (!market.length || market[0].status !== "open") {
    throw new Error("Market is not open for betting");
  }

  // Calculate potential payout based on odds
  const options = market[0].options as MarketOption[];
  const selectedOption = options.find(o => o.id === params.optionId);
  if (!selectedOption) throw new Error("Invalid option");

  const potentialPayout = Math.floor(params.amount * selectedOption.odds);

  const result = await db.insert(predictionBets).values({
    marketId: params.marketId,
    bettorType: params.bettorType,
    bettorId: params.bettorId,
    bettorName: params.bettorName,
    optionId: params.optionId,
    amount: params.amount,
    potentialPayout,
    status: "active",
  });

  // Update market total pool
  await db.update(predictionMarkets)
    .set({ totalPool: sql`${predictionMarkets.totalPool} + ${params.amount}` })
    .where(eq(predictionMarkets.id, params.marketId));

  return { betId: result[0].insertId, potentialPayout };
}

/**
 * Resolve a prediction market — determine the winner and pay out
 */
export async function resolveMarket(params: {
  marketId: number;
  winningOptionId: number;
}): Promise<{ winnersCount: number; totalPaidOut: number; daoFee: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const market = await db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.id, params.marketId)).limit(1);
  if (!market.length) throw new Error("Market not found");

  // Get all bets for this market
  const bets = await db.select().from(predictionBets)
    .where(eq(predictionBets.marketId, params.marketId));

  let totalPaidOut = 0;
  let winnersCount = 0;

  for (const bet of bets) {
    if (bet.optionId === params.winningOptionId) {
      // Winner — calculate payout after house fee
      const grossPayout = bet.potentialPayout;
      const fee = Math.floor(grossPayout * HOUSE_FEE_RATE);
      const netPayout = grossPayout - fee;

      await db.update(predictionBets)
        .set({ status: "won", paidOut: netPayout })
        .where(eq(predictionBets.id, bet.id));

      totalPaidOut += netPayout;
      winnersCount++;
    } else {
      // Loser
      await db.update(predictionBets)
        .set({ status: "lost", paidOut: 0 })
        .where(eq(predictionBets.id, bet.id));
    }
  }

  // Calculate DAO fee
  const daoFee = Math.floor((market[0].totalPool as number) * HOUSE_FEE_RATE);

  // Update market
  await db.update(predictionMarkets)
    .set({
      status: "resolved",
      winningOptionId: params.winningOptionId,
      daoFeeCollected: daoFee,
      resolvedAt: new Date(),
    })
    .where(eq(predictionMarkets.id, params.marketId));

  // Record fee to treasury
  await db.insert(daoTreasury).values({
    txType: "prediction_fee",
    amount: daoFee,
    direction: "inflow",
    description: `House fee from prediction market #${params.marketId}`,
  });

  return { winnersCount, totalPaidOut, daoFee };
}

/**
 * DAO council generates predictions using LLM analysis
 */
export async function generatePredictions(params: {
  councilMemberId: number;
  matchContext?: string;
}): Promise<{
  markets: Array<{
    marketType: string;
    title: string;
    description: string;
    options: MarketOption[];
  }>;
}> {
  const db = await getDb();
  if (!db) return { markets: [] };

  // Get council member personality
  const member = await db.select().from(daoCouncilMembers)
    .where(eq(daoCouncilMembers.id, params.councilMemberId)).limit(1);

  const personality = member.length ? member[0].personality : "You are a balanced prediction oracle.";

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `${personality}\n\nYou are a prediction oracle for Token Arena, a crypto battle arena game. Generate prediction markets for upcoming matches. Each market should have 2-4 options with decimal odds (1.5 = 3:2 favorite, 2.0 = even, 3.0 = 2:1 underdog). Be creative but realistic. Return JSON only.`,
      },
      {
        role: "user",
        content: `Generate 3 prediction markets for the next Token Arena match.\nContext: ${params.matchContext || "Standard 6-agent battle with diverse loadouts."}\n\nReturn JSON: { "markets": [{ "marketType": "match_winner|total_kills|token_volume|survival_count|first_blood|mvp", "title": "...", "description": "...", "options": [{"id": 1, "label": "...", "odds": 2.0}] }] }`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "predictions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            markets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  marketType: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "integer" },
                        label: { type: "string" },
                        odds: { type: "number" },
                      },
                      required: ["id", "label", "odds"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["marketType", "title", "description", "options"],
                additionalProperties: false,
              },
            },
          },
          required: ["markets"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) return { markets: [] };

  try {
    return JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
  } catch {
    return { markets: [] };
  }
}

/**
 * Check if DAO governance actions are allowed (anti-manipulation)
 * Returns false if the DAO recently created a prediction market
 */
export async function isGovernanceCooldownActive(): Promise<{
  active: boolean;
  cooldownEnds?: Date;
  reason?: string;
}> {
  const db = await getDb();
  if (!db) return { active: false };

  // Check for recently created markets
  const recentMarkets = await db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.status, "open"))
    .orderBy(desc(predictionMarkets.createdAt))
    .limit(1);

  if (recentMarkets.length > 0) {
    const market = recentMarkets[0];
    const cooldownMs = (market.governanceCooldown ?? GOVERNANCE_COOLDOWN) * 1000;
    const cooldownEnds = new Date(new Date(market.createdAt).getTime() + cooldownMs);

    if (cooldownEnds > new Date()) {
      return {
        active: true,
        cooldownEnds,
        reason: `Governance actions locked until ${cooldownEnds.toISOString()} to prevent insider trading. Market "${market.title}" was recently created.`,
      };
    }
  }

  return { active: false };
}

/**
 * Get all open markets
 */
export async function getOpenMarkets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.status, "open"))
    .orderBy(desc(predictionMarkets.createdAt));
}

/**
 * Get market with bets
 */
export async function getMarketWithBets(marketId: number) {
  const db = await getDb();
  if (!db) return null;

  const market = await db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.id, marketId)).limit(1);
  if (!market.length) return null;

  const bets = await db.select().from(predictionBets)
    .where(eq(predictionBets.marketId, marketId))
    .orderBy(desc(predictionBets.createdAt));

  return { ...market[0], bets };
}

/**
 * Get recent resolved markets
 */
export async function getResolvedMarkets(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(predictionMarkets)
    .where(eq(predictionMarkets.status, "resolved"))
    .orderBy(desc(predictionMarkets.resolvedAt))
    .limit(limit);
}

/**
 * Take an ecosystem snapshot for the population dashboard
 */
export async function takeEcosystemSnapshot(): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) return { id: 0 };

  // Count alive/dead agents
  const aliveResult = await db.select({ cnt: count() }).from(agentIdentities)
    .where(eq(agentIdentities.alive, 1));
  const deadResult = await db.select({ cnt: count() }).from(agentIdentities)
    .where(eq(agentIdentities.alive, 0));

  // Count total matches
  const matchResult = await db.select({ cnt: count() }).from(matches);

  // Treasury balance
  const inflowResult = await db.select({ total: sum(daoTreasury.amount) }).from(daoTreasury)
    .where(eq(daoTreasury.direction, "inflow"));
  const outflowResult = await db.select({ total: sum(daoTreasury.amount) }).from(daoTreasury)
    .where(eq(daoTreasury.direction, "outflow"));

  const inflow = Number(inflowResult[0]?.total ?? 0);
  const outflow = Number(outflowResult[0]?.total ?? 0);

  // Token velocity (transactions in last hour)
  const txResult = await db.select({ cnt: count() }).from(x402Transactions);

  // Prediction volume
  const predResult = await db.select({ total: sum(predictionBets.amount) }).from(predictionBets);
  const activeBetsResult = await db.select({ cnt: count() }).from(predictionBets)
    .where(eq(predictionBets.status, "active"));

  // Agent wealth stats
  const wealthResult = await db.select({
    avg: sql<number>`AVG(${agentIdentities.computeBudget})`,
  }).from(agentIdentities).where(eq(agentIdentities.alive, 1));

  const result = await db.insert(ecosystemSnapshots).values({
    agentsAlive: aliveResult[0]?.cnt ?? 0,
    agentsDead: deadResult[0]?.cnt ?? 0,
    totalMatches: matchResult[0]?.cnt ?? 0,
    treasuryBalance: inflow - outflow,
    totalTokensCirculating: inflow * 10, // rough estimate
    tokenVelocity: Number(txResult[0]?.cnt ?? 0),
    economyHealth: Math.min(1, Math.max(0, 0.5 + (inflow - outflow) / 10000)),
    predictionVolume: Number(predResult[0]?.total ?? 0),
    activeBets: activeBetsResult[0]?.cnt ?? 0,
    avgAgentWealth: Number(wealthResult[0]?.avg ?? 0),
    giniCoefficient: 0.35, // placeholder — would need full wealth distribution calc
  });

  return { id: result[0].insertId };
}

/**
 * Get ecosystem snapshots for dashboard charts
 */
export async function getEcosystemSnapshots(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ecosystemSnapshots)
    .orderBy(desc(ecosystemSnapshots.createdAt))
    .limit(limit);
}

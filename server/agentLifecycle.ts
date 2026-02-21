/**
 * Agent Lifecycle & Token Economics
 * 
 * Manages:
 * 1. Agent spawn/death based on token balance
 * 2. Token-to-compute flywheel (earnings → compute budget)
 * 3. Memory cost economics (maintenance + query costs)
 * 4. Self-sustaining agent detection
 */

import { getDb } from "./db";
import { agentIdentities, x402Transactions } from "../drizzle/schema";
import { eq, and, gte, lt } from "drizzle-orm";

// LLM model key → display label mapping
const LLM_LABELS: Record<string, string> = {
  "claude-3-5-sonnet": "Claude 3.5 🧠",
  "gpt-4o": "GPT-4o ⚡",
  "llama-3.1-70b": "Llama 70B 🦙",
  "mistral-large": "Mistral 🌬️",
  "gemini-flash": "Gemini ✨",
  "deepseek-v3": "DeepSeek 🔮",
};

function getLLMLabel(modelKey?: string): string {
  if (!modelKey) return "AI";
  return LLM_LABELS[modelKey] || modelKey;
}

export interface AgentEconomics {
  agentId: number;
  agentName: string;
  tokenBalance: number;
  computeBudget: number;
  memorySize: number;
  memoryCostPerCycle: number;
  isBankrupt: boolean;
  isSelfSustaining: boolean;
  monthlyEarnings: number;
  monthlySpending: number;
  lastMatchEarnings: number;
  lastMatchSpending: number;
  llmModel?: string;
  llmLabel?: string;
  wins?: number;
  losses?: number;
  totalKills?: number;
  totalDeaths?: number;
}

export interface ComputeSpending {
  agentId: number;
  type: "llm_call" | "skybox_generation" | "memory_maintenance" | "memory_query";
  tokensSpent: number;
  timestamp: number;
  description: string;
}

/**
 * Check if an agent is bankrupt (token balance <= 0)
 */
export async function isAgentBankrupt(agentId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const results = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, agentId))
    .limit(1);

  if (results.length === 0) return false;
  const agent = results[0];
  const balance = (agent.totalTokensEarned ?? 0) - (agent.totalTokensSpent ?? 0);
  return balance <= 0
}

/**
 * Record compute spending for an agent
 */
export async function recordComputeSpending(spending: ComputeSpending): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Deduct from agent balance
  const agent = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, spending.agentId))
    .limit(1);

  if (agent.length === 0) return;

  const newSpent = (agent[0].totalTokensSpent ?? 0) + spending.tokensSpent;
  await db
    .update(agentIdentities)
    .set({ totalTokensSpent: newSpent })
    .where(eq(agentIdentities.agentId, spending.agentId));

  // Log transaction
  await db.insert(x402Transactions).values({
    paymentId: `compute_${spending.agentId}_${spending.timestamp}`,
    txHash: `compute_${spending.agentId}_${spending.timestamp}`,
    action: spending.type,
    tokenSymbol: "ARENA",
    amount: -spending.tokensSpent,
    fromAddress: `agent_${spending.agentId}`,
    toAddress: "compute_pool",
    agentId: spending.agentId,
    success: 1,
  });

  console.log(`[AgentLifecycle] Agent ${spending.agentId} spent ${spending.tokensSpent} tokens on ${spending.type}`);
}

/**
 * Calculate memory maintenance cost per cycle
 * Cost = (memory_size_in_kb / 100) tokens per cycle
 * Larger memory = more expensive to maintain
 */
export function calculateMemoryCost(memorySizeKb: number): number {
  return Math.ceil(memorySizeKb / 100);
}

/**
 * Calculate memory query cost
 * Cost = (query_size_in_kb / 50) tokens per query
 * Retrieving memories costs compute
 */
export function calculateMemoryQueryCost(querySizeKb: number): number {
  return Math.ceil(querySizeKb / 50);
}

/**
 * Get agent economics snapshot
 */
export async function getAgentEconomics(agentId: number): Promise<AgentEconomics | null> {
  const db = await getDb();
  if (!db) return null;

  const agent = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, agentId))
    .limit(1);

  if (agent.length === 0) return null;

  const a = agent[0];
  const balance = (a.totalTokensEarned ?? 0) - (a.totalTokensSpent ?? 0);
  const memorySize = 0; // TODO: track agent memory size
  const memoryCost = calculateMemoryCost(memorySize);

  // Get last 30 days of transactions
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const transactions = await db
    .select()
    .from(x402Transactions)
    .where(
      and(
        eq(x402Transactions.agentId, agentId),
        gte(x402Transactions.createdAt, thirtyDaysAgo)
      )
    );

  const monthlyEarnings = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const monthlySpending = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount ?? 0), 0);

  const isSelfSustaining = monthlyEarnings > monthlySpending && monthlyEarnings > 0;

  return {
    agentId,
    agentName: a.name ?? `Agent ${agentId}`,
    tokenBalance: balance,
    computeBudget: Math.max(0, balance - memoryCost),
    memorySize,
    memoryCostPerCycle: memoryCost,
    isBankrupt: balance <= 0,
    isSelfSustaining,
    monthlyEarnings,
    monthlySpending,
    lastMatchEarnings: 0, // Updated after match
    lastMatchSpending: 0, // Updated after match
    llmModel: (a as any).llmModel ?? undefined,
    llmLabel: getLLMLabel((a as any).llmModel),
    wins: a.totalMatches ? Math.floor(a.totalMatches * ((a.totalKills ?? 0) / Math.max(1, (a.totalKills ?? 0) + (a.totalDeaths ?? 0)))) : 0,
    losses: a.totalMatches ? a.totalMatches - Math.floor(a.totalMatches * ((a.totalKills ?? 0) / Math.max(1, (a.totalKills ?? 0) + (a.totalDeaths ?? 0)))) : 0,
    totalKills: a.totalKills ?? 0,
    totalDeaths: a.totalDeaths ?? 0,
  };
}

/**
 * Get all bankrupt agents
 */
export async function getBankruptAgents(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  const agents = await db.select().from(agentIdentities);
  return agents
    .filter(a => ((a.totalTokensEarned ?? 0) - (a.totalTokensSpent ?? 0)) <= 0)
    .map(a => a.agentId);
}

/**
 * Get all self-sustaining agents
 */
export async function getSelfSustainingAgents(): Promise<AgentEconomics[]> {
  const db = await getDb();
  if (!db) return [];

  const agents = await db.select().from(agentIdentities);
  const economics: AgentEconomics[] = [];

  for (const agent of agents) {
    const econ = await getAgentEconomics(agent.agentId);
    if (econ && econ.isSelfSustaining) {
      economics.push(econ);
    }
  }

  return economics;
}

/**
 * Calculate ecosystem health metrics
 */
export async function getEcosystemHealth() {
  const db = await getDb();
  if (!db) return null;

  const agents = await db.select().from(agentIdentities);
  if (agents.length === 0) return null;

  const bankrupt = agents.filter(a => ((a.totalTokensEarned ?? 0) - (a.totalTokensSpent ?? 0)) <= 0).length;
  const totalTokens = agents.reduce((sum, a) => sum + ((a.totalTokensEarned ?? 0) - (a.totalTokensSpent ?? 0)), 0);
  const avgBalance = totalTokens / agents.length;

  const selfSustaining = await getSelfSustainingAgents();
  const sustainabilityRate = agents.length > 0 ? selfSustaining.length / agents.length : 0;

  return {
    totalAgents: agents.length,
    bankruptAgents: bankrupt,
    totalTokensInCirculation: totalTokens,
    avgAgentBalance: avgBalance,
    selfSustainingRate: sustainabilityRate,
    economyHealth: sustainabilityRate > 0.5 ? "healthy" : sustainabilityRate > 0.3 ? "struggling" : "critical",
  };
}

/**
 * Token-to-Compute Flywheel visualization data
 * Shows how agent earnings translate to compute budget
 */
export interface FlywheelData {
  agentId: number;
  agentName: string;
  earnings: number;
  spending: number;
  netProfit: number;
  computeBudget: number;
  memoryMaintenance: number;
  availableForLLM: number;
  availableForSkybox: number;
  efficiency: number; // earnings / spending ratio
  trajectory: "ascending" | "stable" | "declining" | "bankrupt";
  llmModel?: string;
  llmLabel?: string;
  wins?: number;
  losses?: number;
  totalKills?: number;
  totalDeaths?: number;
}

/**
 * Calculate flywheel data for visualization
 */
export async function getFlywheelData(agentId: number): Promise<FlywheelData | null> {
  const econ = await getAgentEconomics(agentId);
  if (!econ) return null;

  const netProfit = econ.monthlyEarnings - econ.monthlySpending;
  const efficiency = econ.monthlySpending > 0 ? econ.monthlyEarnings / econ.monthlySpending : 0;

  let trajectory: "ascending" | "stable" | "declining" | "bankrupt" = "stable";
  if (econ.isBankrupt) trajectory = "bankrupt";
  else if (efficiency > 1.5) trajectory = "ascending";
  else if (efficiency < 0.5) trajectory = "declining";

  // Compute budget allocation
  const computeBudget = econ.computeBudget;
  const memoryMaintenance = econ.memoryCostPerCycle;
  const availableForLLM = Math.floor(computeBudget * 0.6); // 60% for LLM calls
  const availableForSkybox = Math.floor(computeBudget * 0.4); // 40% for skybox generation

  return {
    agentId,
    agentName: econ.agentName,
    earnings: econ.monthlyEarnings,
    spending: econ.monthlySpending,
    netProfit,
    computeBudget,
    memoryMaintenance,
    availableForLLM,
    availableForSkybox,
    efficiency,
    trajectory,
    llmModel: econ.llmModel,
    llmLabel: econ.llmLabel,
    wins: econ.wins,
    losses: econ.losses,
    totalKills: econ.totalKills,
    totalDeaths: econ.totalDeaths,
  };
}

/**
 * Get all agents' flywheel data for dashboard
 */
export async function getAllFlywheelData(): Promise<FlywheelData[]> {
  const db = await getDb();
  if (!db) return [];

  const agents = await db.select().from(agentIdentities);
  const flywheels: FlywheelData[] = [];

  for (const agent of agents) {
    const fw = await getFlywheelData(agent.agentId);
    if (fw) flywheels.push(fw);
  }

  return flywheels;
}

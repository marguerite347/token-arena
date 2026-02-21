/**
 * DAO Domain Controller Service
 * 
 * Each of the 5 DAO council masters controls a specific domain:
 *   ARCHON → matchmaking/scheduling
 *   FORGE → economy/token supply
 *   ENTROPY → arena generation/environment
 *   JUSTICE → rules/disputes
 *   EQUILIBRIA → balance/meta
 * 
 * Each has their own wallet with ARENA tokens and compute budget.
 */
import { getDb } from "./db";
import { eq, desc, sql as drizzleSql } from "drizzle-orm";

export const DOMAIN_CONFIG = {
  matchmaking: {
    councilMemberName: "ARCHON",
    description: "Controls matchmaking, scheduling, and tournament organization",
    actions: ["schedule_match", "create_tournament", "adjust_matchmaking_elo", "set_queue_priority"],
  },
  economy: {
    councilMemberName: "FORGE",
    description: "Controls token supply, fee structures, and economic policy",
    actions: ["adjust_fees", "mint_tokens", "burn_tokens", "set_revival_prices", "adjust_rewards"],
  },
  arenas: {
    councilMemberName: "ENTROPY",
    description: "Controls arena generation, environmental hazards, and map rotation",
    actions: ["generate_arena", "add_hazard", "rotate_maps", "set_arena_difficulty"],
  },
  rules: {
    councilMemberName: "JUSTICE",
    description: "Controls rules enforcement, dispute resolution, and banning",
    actions: ["resolve_dispute", "issue_warning", "ban_agent", "modify_rules", "review_appeal"],
  },
  balance: {
    councilMemberName: "EQUILIBRIA",
    description: "Controls meta balance, weapon tuning, and agent stat adjustments",
    actions: ["nerf_weapon", "buff_weapon", "adjust_agent_stats", "rebalance_meta", "set_spawn_rates"],
  },
};

// ─── Initialize domain wallets ──────────────────────────────────────────────
export async function initializeDomainWallets() {
  const db = await getDb();
  if (!db) return;
  const { daoDomainWallets, daoCouncilMembers } = await import("../drizzle/schema");

  const existing = await db.select().from(daoDomainWallets);
  if (existing.length >= 5) return existing;

  const council = await db.select().from(daoCouncilMembers);
  if (council.length === 0) return [];

  const domains = Object.entries(DOMAIN_CONFIG);
  for (const [domain, config] of domains) {
    const member = council.find(c => c.name === config.councilMemberName);
    if (!member) continue;

    const exists = existing.find(e => e.councilMemberId === member.id);
    if (exists) continue;

    await db.insert(daoDomainWallets).values({
      councilMemberId: member.id,
      councilMemberName: member.name,
      domain,
      walletBalance: 10000,
      computeBudget: 5000,
    });
  }

  return db.select().from(daoDomainWallets);
}

// ─── Execute a domain action ────────────────────────────────────────────────
export async function executeDomainAction(params: {
  domain: string;
  actionType: string;
  description: string;
  computeCost?: number;
  tokenCost?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { daoDomainWallets, daoDomainActions } = await import("../drizzle/schema");

  const [wallet] = await db.select().from(daoDomainWallets).where(eq(daoDomainWallets.domain, params.domain));
  if (!wallet) throw new Error(`Domain wallet not found for ${params.domain}`);

  const computeCost = params.computeCost || 100;
  const tokenCost = params.tokenCost || 0;

  if (wallet.computeBudget - wallet.computeSpent < computeCost) {
    throw new Error(`${wallet.councilMemberName} has insufficient compute budget for this action`);
  }
  if (wallet.walletBalance < tokenCost) {
    throw new Error(`${wallet.councilMemberName} has insufficient ARENA balance for this action`);
  }

  // Record the action
  const [action] = await db.insert(daoDomainActions).values({
    domainWalletId: wallet.id,
    domain: params.domain,
    actionType: params.actionType,
    description: params.description,
    computeCost,
    tokenCost,
  }).$returningId();

  // Deduct costs
  await db.update(daoDomainWallets).set({
    computeSpent: drizzleSql`${daoDomainWallets.computeSpent} + ${computeCost}`,
    walletBalance: drizzleSql`${daoDomainWallets.walletBalance} - ${tokenCost}`,
    actionsPerformed: drizzleSql`${daoDomainWallets.actionsPerformed} + 1`,
    lastActionDescription: params.description,
    lastActionAt: new Date(),
  }).where(eq(daoDomainWallets.id, wallet.id));

  return {
    actionId: action.id,
    domain: params.domain,
    controller: wallet.councilMemberName,
    actionType: params.actionType,
    computeCost,
    tokenCost,
    remainingCompute: wallet.computeBudget - wallet.computeSpent - computeCost,
    remainingBalance: wallet.walletBalance - tokenCost,
  };
}

// ─── Get all domain wallets with stats ──────────────────────────────────────
export async function getDomainWallets() {
  const db = await getDb();
  if (!db) return [];
  const { daoDomainWallets } = await import("../drizzle/schema");

  return db.select().from(daoDomainWallets);
}

// ─── Get domain action history ──────────────────────────────────────────────
export async function getDomainActions(domain?: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const { daoDomainActions } = await import("../drizzle/schema");

  if (domain) {
    return db.select().from(daoDomainActions)
      .where(eq(daoDomainActions.domain, domain))
      .orderBy(desc(daoDomainActions.createdAt))
      .limit(limit);
  }

  return db.select().from(daoDomainActions)
    .orderBy(desc(daoDomainActions.createdAt))
    .limit(limit);
}

// ─── Replenish domain budgets (called periodically or by DAO vote) ──────────
export async function replenishDomainBudgets(amount: number = 2000) {
  const db = await getDb();
  if (!db) return;
  const { daoDomainWallets } = await import("../drizzle/schema");

  await db.update(daoDomainWallets).set({
    walletBalance: drizzleSql`${daoDomainWallets.walletBalance} + ${amount}`,
    computeBudget: drizzleSql`${daoDomainWallets.computeBudget} + ${Math.round(amount / 2)}`,
  });

  return { replenished: amount, computeAdded: Math.round(amount / 2) };
}

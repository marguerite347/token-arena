/**
 * Memory Marketplace — Tradeable Agent Memory NFTs
 *
 * When an agent dies (goes bankrupt), their memories/experience can be minted
 * as "Memory NFTs" that other agents can buy and absorb. This creates a memory
 * marketplace where battle experience, arena knowledge, and tactical strategies
 * become tradeable assets.
 *
 * Architecture is IPFS-ready: each memory has a content hash for decentralized
 * storage (0g Labs bounty narrative). The data format mirrors what would be
 * stored on IPFS — the demo uses the DB but the structure is identical.
 *
 * Flywheel integration: agents spend ARENA tokens to buy memories, which
 * improves their reasoning, which helps them win more, which earns more ARENA.
 */

import { createHash } from "crypto";
import { getDb } from "./db";
import {
  memoryNfts,
  agentMemory,
  agentIdentities,
  agentReputation,
  x402Transactions,
} from "../drizzle/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

// ─── Rarity Calculation ────────────────────────────────────────────────────

/**
 * Calculate memory rarity based on confidence, success rate, and type
 */
function calculateRarity(
  confidence: number,
  successRate: number,
  memoryType: string,
): "common" | "rare" | "epic" | "legendary" {
  const score = confidence * 0.4 + successRate * 0.4 + (memoryType === "strategy" ? 0.2 : 0);
  if (score >= 0.85) return "legendary";
  if (score >= 0.7) return "epic";
  if (score >= 0.5) return "rare";
  return "common";
}

/**
 * Calculate list price based on rarity and memory quality
 */
function calculateListPrice(
  rarity: string,
  confidence: number,
  successRate: number,
): number {
  const basePrice: Record<string, number> = {
    common: 25,
    rare: 75,
    epic: 150,
    legendary: 300,
  };
  const base = basePrice[rarity] ?? 25;
  const qualityBonus = Math.floor((confidence + successRate) * 50);
  return base + qualityBonus;
}

/**
 * Generate a simulated IPFS-style content hash for a memory
 * In production this would be the actual IPFS CID
 */
function generateContentHash(content: string, agentId: number, timestamp: number): string {
  return createHash("sha256")
    .update(`${agentId}:${timestamp}:${content}`)
    .digest("hex")
    .slice(0, 46); // IPFS CIDs are ~46 chars
}

/**
 * Generate a simulated NFT token ID
 */
function generateTokenId(agentId: number, memoryId: number): string {
  return `MEM-${agentId.toString().padStart(4, "0")}-${memoryId.toString().padStart(6, "0")}-${Date.now().toString(36).toUpperCase()}`;
}

// ─── Mint Memory NFTs from Dead Agent ─────────────────────────────────────

/**
 * When an agent dies, mint all their memories as NFTs for the marketplace.
 * Returns the minted NFT records.
 */
export async function mintDeadAgentMemories(
  agentId: number,
  agentName: string,
): Promise<Array<{
  tokenId: string;
  memoryType: string;
  summary: string;
  rarity: string;
  listPrice: number;
  contentHash: string;
}>> {
  const db = await getDb();
  if (!db) return [];

  // Fetch all active memories from the dead agent
  const memories = await db
    .select()
    .from(agentMemory)
    .where(and(eq(agentMemory.agentId, agentId), eq(agentMemory.active, 1)));

  if (memories.length === 0) {
    console.log(`[MemoryMarket] Agent ${agentName} had no memories to mint`);
    return [];
  }

  const minted: Array<{
    tokenId: string;
    memoryType: string;
    summary: string;
    rarity: string;
    listPrice: number;
    contentHash: string;
  }> = [];

  for (const memory of memories) {
    const rarity = calculateRarity(
      memory.confidence,
      memory.successRate,
      memory.memoryType,
    );
    const listPrice = calculateListPrice(rarity, memory.confidence, memory.successRate);
    const contentHash = generateContentHash(memory.content, agentId, memory.createdAt.getTime());
    const tokenId = generateTokenId(agentId, memory.id);

    // Create a short summary for the marketplace listing
    const summary = `${agentName}'s ${memory.memoryType} memory: "${memory.content.slice(0, 100)}${memory.content.length > 100 ? "..." : ""}"`;

    // Mint the NFT
    await db.insert(memoryNfts).values({
      tokenId,
      originalAgentId: agentId,
      originalAgentName: agentName,
      currentOwnerAgentId: null, // Listed on marketplace
      memoryType: memory.memoryType,
      content: memory.content,
      summary,
      rarity,
      confidence: memory.confidence,
      successRate: memory.successRate,
      listPrice,
      status: "listed",
      ipfsHash: `ipfs://${contentHash}`, // IPFS-ready format
      contentHash,
    });

    // Mark original memory as inactive (it's been NFT-ized)
    await db
      .update(agentMemory)
      .set({ active: 0 })
      .where(eq(agentMemory.id, memory.id));

    minted.push({ tokenId, memoryType: memory.memoryType, summary, rarity, listPrice, contentHash });
    console.log(`[MemoryMarket] Minted ${rarity} Memory NFT ${tokenId} from ${agentName} (${listPrice} ARENA)`);
  }

  console.log(`[MemoryMarket] Minted ${minted.length} Memory NFTs from dead agent ${agentName}`);
  return minted;
}

// ─── Buy Memory NFT ────────────────────────────────────────────────────────

/**
 * An agent buys a Memory NFT from the marketplace.
 * The memory is absorbed into the buyer's active memories.
 */
export async function buyMemoryNft(
  tokenId: string,
  buyerAgentId: number,
  buyerAgentName: string,
): Promise<{
  success: boolean;
  message: string;
  memory?: { type: string; content: string; rarity: string };
  cost?: number;
}> {
  const db = await getDb();
  if (!db) return { success: false, message: "Database unavailable" };

  // Fetch the NFT
  const nftRows = await db
    .select()
    .from(memoryNfts)
    .where(and(eq(memoryNfts.tokenId, tokenId), eq(memoryNfts.status, "listed")))
    .limit(1);

  if (nftRows.length === 0) {
    return { success: false, message: "Memory NFT not found or already sold" };
  }

  const nft = nftRows[0];

  // Can't buy your own memories
  if (nft.originalAgentId === buyerAgentId) {
    return { success: false, message: "Cannot buy your own memories" };
  }

  // Check buyer's token balance
  const buyerRows = await db
    .select()
    .from(agentIdentities)
    .where(eq(agentIdentities.agentId, buyerAgentId))
    .limit(1);

  if (buyerRows.length === 0) {
    return { success: false, message: "Buyer agent not found" };
  }

  const buyer = buyerRows[0];
  const buyerBalance = (buyer.totalTokensEarned ?? 0) - (buyer.totalTokensSpent ?? 0);

  if (buyerBalance < nft.listPrice) {
    return {
      success: false,
      message: `Insufficient balance: need ${nft.listPrice} ARENA, have ${buyerBalance}`,
    };
  }

  // Execute the purchase
  // 1. Deduct from buyer
  await db
    .update(agentIdentities)
    .set({ totalTokensSpent: sql`totalTokensSpent + ${nft.listPrice}` })
    .where(eq(agentIdentities.agentId, buyerAgentId));

  // 2. Mark NFT as sold and owned by buyer
  await db
    .update(memoryNfts)
    .set({
      status: "absorbed",
      currentOwnerAgentId: buyerAgentId,
      soldAt: new Date(),
    })
    .where(eq(memoryNfts.tokenId, tokenId));

  // 3. Absorb memory into buyer's active memories
  await db.insert(agentMemory).values({
    agentId: buyerAgentId,
    memoryType: nft.memoryType,
    content: `[ABSORBED from ${nft.originalAgentName}] ${nft.content}`,
    confidence: nft.confidence * 0.9, // Slight degradation when absorbed
    successRate: nft.successRate * 0.9,
    computeCost: 2, // Absorbed memories cost slightly more to maintain
    isPrivate: 0, // Absorbed memories are not private
  });

  // 4. Log the transaction
  await db.insert(x402Transactions).values({
    paymentId: `mem-buy-${tokenId}-${Date.now()}`,
    txHash: `0xmem${tokenId.replace(/-/g, "").toLowerCase().slice(0, 60)}`,
    action: "memory_purchase",
    tokenSymbol: "ARENA",
    amount: nft.listPrice,
    fromAddress: `agent_${buyerAgentId}`,
    toAddress: `agent_${nft.originalAgentId}_estate`,
    agentId: buyerAgentId,
    feeAmount: Math.floor(nft.listPrice * 0.05), // 5% marketplace fee
    feeRecipient: "0xDAO_TREASURY",
    success: 1,
    metadata: {
      tokenId,
      originalAgent: nft.originalAgentName,
      memoryType: nft.memoryType,
      rarity: nft.rarity,
      ipfsHash: nft.ipfsHash,
      flywheel: "arena→memory_nft→knowledge→wins→arena",
    },
  });

  // 5. Update reputation for buyer
  await updateAgentReputation(buyerAgentId, buyerAgentName, { memoriesAbsorbed: 1 });

  console.log(
    `[MemoryMarket] Agent ${buyerAgentName} absorbed ${nft.rarity} memory from ${nft.originalAgentName} for ${nft.listPrice} ARENA`,
  );

  return {
    success: true,
    message: `Successfully absorbed ${nft.rarity} memory from ${nft.originalAgentName}`,
    memory: { type: nft.memoryType, content: nft.content, rarity: nft.rarity },
    cost: nft.listPrice,
  };
}

// ─── Get Marketplace Listings ──────────────────────────────────────────────

export async function getMarketplaceListings(limit = 50): Promise<Array<{
  tokenId: string;
  originalAgentName: string;
  memoryType: string;
  summary: string;
  rarity: string;
  confidence: number;
  successRate: number;
  listPrice: number;
  ipfsHash: string | null;
  contentHash: string | null;
  mintedAt: Date;
}>> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      tokenId: memoryNfts.tokenId,
      originalAgentName: memoryNfts.originalAgentName,
      memoryType: memoryNfts.memoryType,
      summary: memoryNfts.summary,
      rarity: memoryNfts.rarity,
      confidence: memoryNfts.confidence,
      successRate: memoryNfts.successRate,
      listPrice: memoryNfts.listPrice,
      ipfsHash: memoryNfts.ipfsHash,
      contentHash: memoryNfts.contentHash,
      mintedAt: memoryNfts.mintedAt,
    })
    .from(memoryNfts)
    .where(eq(memoryNfts.status, "listed"))
    .orderBy(desc(memoryNfts.listPrice))
    .limit(limit);
}

export async function getAgentMemoryNfts(agentId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(memoryNfts)
    .where(eq(memoryNfts.currentOwnerAgentId, agentId))
    .orderBy(desc(memoryNfts.soldAt));
}

// ─── Reputation System ─────────────────────────────────────────────────────

/**
 * Calculate reputation tier from score
 */
function getReputationTier(score: number): string {
  if (score >= 900) return "legendary";
  if (score >= 700) return "platinum";
  if (score >= 500) return "gold";
  if (score >= 300) return "silver";
  return "bronze";
}

/**
 * Calculate DAO voting power from reputation score
 */
function calculateVotingPower(score: number): number {
  return Math.max(1, Math.floor(score / 100));
}

/**
 * Calculate reward multiplier from reputation
 */
function calculateRewardMultiplier(score: number): number {
  return 1.0 + (score / 1000) * 0.5; // Max 1.5x at 1000 rep
}

/**
 * Update agent reputation after a match or event
 */
export async function updateAgentReputation(
  agentId: number,
  agentName: string,
  delta: {
    won?: boolean;
    memoriesAbsorbed?: number;
    memoriesSold?: number;
  },
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Upsert reputation record
  const existing = await db
    .select()
    .from(agentReputation)
    .where(eq(agentReputation.agentId, agentId))
    .limit(1);

  if (existing.length === 0) {
    // Create initial reputation record
    await db.insert(agentReputation).values({
      agentId,
      agentName,
      reputationScore: 300,
      tier: "bronze",
      totalWins: delta.won ? 1 : 0,
      totalLosses: delta.won === false ? 1 : 0,
      winStreak: delta.won ? 1 : 0,
      bestWinStreak: delta.won ? 1 : 0,
      memoriesAbsorbed: delta.memoriesAbsorbed ?? 0,
      memoriesSold: delta.memoriesSold ?? 0,
      daoVotingPower: 3,
      reputationMultiplier: 1.0,
    });
    return;
  }

  const rep = existing[0];
  let newScore = rep.reputationScore;
  let newWinStreak = rep.winStreak;
  let newBestStreak = rep.bestWinStreak;

  // Score changes
  if (delta.won === true) {
    newScore = Math.min(1000, newScore + 15 + Math.floor(newWinStreak * 2)); // Win streak bonus
    newWinStreak += 1;
    newBestStreak = Math.max(newBestStreak, newWinStreak);
  } else if (delta.won === false) {
    newScore = Math.max(0, newScore - 10);
    newWinStreak = 0;
  }

  // Memory absorption boosts reputation
  if (delta.memoriesAbsorbed) {
    newScore = Math.min(1000, newScore + delta.memoriesAbsorbed * 5);
  }

  const newTier = getReputationTier(newScore);
  const newVotingPower = calculateVotingPower(newScore);
  const newMultiplier = calculateRewardMultiplier(newScore);

  await db
    .update(agentReputation)
    .set({
      reputationScore: newScore,
      tier: newTier,
      totalWins: delta.won === true ? sql`totalWins + 1` : rep.totalWins,
      totalLosses: delta.won === false ? sql`totalLosses + 1` : rep.totalLosses,
      winStreak: newWinStreak,
      bestWinStreak: newBestStreak,
      memoriesAbsorbed: delta.memoriesAbsorbed
        ? sql`memoriesAbsorbed + ${delta.memoriesAbsorbed}`
        : rep.memoriesAbsorbed,
      memoriesSold: delta.memoriesSold
        ? sql`memoriesSold + ${delta.memoriesSold}`
        : rep.memoriesSold,
      daoVotingPower: newVotingPower,
      reputationMultiplier: newMultiplier,
    })
    .where(eq(agentReputation.agentId, agentId));

  // Also update the reputation field in agentIdentities
  await db
    .update(agentIdentities)
    .set({ reputation: newScore })
    .where(eq(agentIdentities.agentId, agentId));
}

export async function getAgentReputationData(agentId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(agentReputation)
    .where(eq(agentReputation.agentId, agentId))
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

export async function getAllAgentReputations() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(agentReputation)
    .orderBy(desc(agentReputation.reputationScore));
}

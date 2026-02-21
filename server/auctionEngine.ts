/**
 * Memory Auction Engine
 * 
 * When an agent dies, its memories go up for auction as Memory NFTs.
 * The dead agent's faction gets a loyalty window (first dibs).
 * After the loyalty window, open bidding begins.
 * Higher reputation agents' memories are worth more.
 */
import { getDb } from "./db";
import { eq, and, desc, lte, sql as drizzleSql } from "drizzle-orm";

// ─── Start an auction for a dead agent's memory NFT ─────────────────────────
export async function startMemoryAuction(params: {
  nftId: number;
  nftTokenId: string;
  deadAgentId: number;
  deadAgentName: string;
  deadAgentFactionId?: number;
  memoryType: string;
  reputationScore?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { memoryAuctions } = await import("../drizzle/schema");

  // Base price scales with reputation (higher rep = more valuable memories)
  const repMultiplier = Math.max(1, (params.reputationScore || 300) / 300);
  const startingPrice = Math.round(50 * repMultiplier);

  // Loyalty window: 5 minutes for home faction
  const now = new Date();
  const loyaltyEnd = new Date(now.getTime() + 5 * 60 * 1000);
  const auctionEnd = new Date(now.getTime() + 15 * 60 * 1000);

  const [auction] = await db.insert(memoryAuctions).values({
    nftId: params.nftId,
    nftTokenId: params.nftTokenId,
    deadAgentId: params.deadAgentId,
    deadAgentName: params.deadAgentName,
    deadAgentFactionId: params.deadAgentFactionId || null,
    memoryType: params.memoryType,
    startingPrice,
    currentBid: 0,
    loyaltyWindowEnds: params.deadAgentFactionId ? loyaltyEnd : now, // no loyalty window for lone wolves
    auctionEnds: auctionEnd,
    status: params.deadAgentFactionId ? "loyalty_window" : "open",
  }).$returningId();

  return {
    auctionId: auction.id,
    startingPrice,
    loyaltyWindowEnds: loyaltyEnd,
    auctionEnds: auctionEnd,
    status: params.deadAgentFactionId ? "loyalty_window" : "open",
  };
}

// ─── Place a bid on an auction ──────────────────────────────────────────────
export async function placeBid(params: {
  auctionId: number;
  bidderId: number;
  bidderName: string;
  bidderType: "agent" | "faction";
  bidAmount: number;
  bidderFactionId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { memoryAuctions, auctionBids } = await import("../drizzle/schema");

  const [auction] = await db.select().from(memoryAuctions).where(eq(memoryAuctions.id, params.auctionId));
  if (!auction) throw new Error("Auction not found");

  // Check auction is still active
  const now = new Date();
  if (auction.status === "sold" || auction.status === "expired") {
    throw new Error("Auction has ended");
  }
  if (now > auction.auctionEnds) {
    throw new Error("Auction time has expired");
  }

  // Check loyalty window
  if (auction.status === "loyalty_window" && auction.loyaltyWindowEnds && now < auction.loyaltyWindowEnds) {
    // Only home faction can bid during loyalty window
    if (params.bidderFactionId !== auction.deadAgentFactionId) {
      throw new Error(`Loyalty window active — only the home faction can bid until ${auction.loyaltyWindowEnds.toISOString()}`);
    }
  }

  // Bid must be higher than current
  const minBid = Math.max(auction.startingPrice, auction.currentBid + 10);
  if (params.bidAmount < minBid) {
    throw new Error(`Bid must be at least ${minBid} ARENA`);
  }

  // Record bid
  await db.insert(auctionBids).values({
    auctionId: params.auctionId,
    bidderId: params.bidderId,
    bidderName: params.bidderName,
    bidderType: params.bidderType,
    bidAmount: params.bidAmount,
    isFactionLoyalty: auction.status === "loyalty_window" ? 1 : 0,
  });

  // Update auction
  const newStatus = auction.status === "loyalty_window" && auction.loyaltyWindowEnds && now >= auction.loyaltyWindowEnds
    ? "open"
    : auction.status;

  await db.update(memoryAuctions).set({
    currentBid: params.bidAmount,
    currentBidderId: params.bidderId,
    currentBidderName: params.bidderName,
    currentBidderType: params.bidderType,
    totalBids: drizzleSql`${memoryAuctions.totalBids} + 1`,
    status: newStatus,
  }).where(eq(memoryAuctions.id, params.auctionId));

  return {
    success: true,
    newBid: params.bidAmount,
    totalBids: auction.totalBids + 1,
    auctionEnds: auction.auctionEnds,
  };
}

// ─── Resolve expired auctions ───────────────────────────────────────────────
export async function resolveAuctions() {
  const db = await getDb();
  if (!db) return [];
  const { memoryAuctions, memoryNfts } = await import("../drizzle/schema");

  const now = new Date();

  // Find auctions past their end time that haven't been resolved
  const expired = await db.select().from(memoryAuctions)
    .where(and(
      lte(memoryAuctions.auctionEnds, now),
      eq(memoryAuctions.status, "open"),
    ));

  // Also transition loyalty_window to open
  const loyaltyExpired = await db.select().from(memoryAuctions)
    .where(and(
      eq(memoryAuctions.status, "loyalty_window"),
    ));

  for (const auction of loyaltyExpired) {
    if (auction.loyaltyWindowEnds && now >= auction.loyaltyWindowEnds) {
      await db.update(memoryAuctions)
        .set({ status: "open" })
        .where(eq(memoryAuctions.id, auction.id));
    }
  }

  const results = [];
  for (const auction of expired) {
    if (auction.currentBid > 0 && auction.currentBidderId) {
      // Sold to highest bidder
      await db.update(memoryAuctions)
        .set({ status: "sold" })
        .where(eq(memoryAuctions.id, auction.id));

      // Transfer NFT ownership
      await db.update(memoryNfts)
        .set({
          status: "absorbed",
          currentOwnerAgentId: auction.currentBidderId,
          soldAt: new Date(),
        })
        .where(eq(memoryNfts.id, auction.nftId));

      results.push({
        auctionId: auction.id,
        winner: auction.currentBidderName,
        price: auction.currentBid,
        memoryType: auction.memoryType,
      });
    } else {
      // No bids — expired
      await db.update(memoryAuctions)
        .set({ status: "expired" })
        .where(eq(memoryAuctions.id, auction.id));

      results.push({
        auctionId: auction.id,
        winner: null,
        price: 0,
        memoryType: auction.memoryType,
      });
    }
  }

  return results;
}

// ─── Get active auctions ────────────────────────────────────────────────────
export async function getActiveAuctions() {
  const db = await getDb();
  if (!db) return [];
  const { memoryAuctions } = await import("../drizzle/schema");

  return db.select().from(memoryAuctions)
    .where(
      drizzleSql`${memoryAuctions.status} IN ('loyalty_window', 'open')`
    )
    .orderBy(desc(memoryAuctions.createdAt));
}

// ─── Get auction history ────────────────────────────────────────────────────
export async function getAuctionHistory(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const { memoryAuctions } = await import("../drizzle/schema");

  return db.select().from(memoryAuctions)
    .orderBy(desc(memoryAuctions.createdAt))
    .limit(limit);
}

// ─── Get bids for an auction ────────────────────────────────────────────────
export async function getAuctionBids(auctionId: number) {
  const db = await getDb();
  if (!db) return [];
  const { auctionBids } = await import("../drizzle/schema");

  return db.select().from(auctionBids)
    .where(eq(auctionBids.auctionId, auctionId))
    .orderBy(desc(auctionBids.bidAmount));
}

/**
 * Battle Royale Service
 * 
 * Manages the dynamic agent pool, NFT death minting, and transaction logging
 * for the always-running battle royale tournament in Watch Mode.
 */

import { randomBytes } from "crypto";

// ─── 24-Agent Battle Royale Pool ─────────────────────────────────────────────

export const BATTLE_ROYALE_AGENTS = [
  // Tier 1 — Elite (high stats, rare LLMs)
  { id: 1,  name: "NEXUS-7",   personality: "aggressive",  weapon: "plasma",    armor: 80, llm: "gpt-4o",          color: "#00ffff", tier: "elite",    description: "Quantum-enhanced assault unit. First to engage, last to retreat." },
  { id: 2,  name: "WRAITH",    personality: "evasive",     weapon: "ghost",     armor: 55, llm: "claude-3-5",      color: "#9945ff", tier: "elite",    description: "Phase-shifting infiltrator. Strikes from the shadows." },
  { id: 3,  name: "TITAN",     personality: "defensive",   weapon: "cannon",    armor: 95, llm: "gpt-4o",          color: "#ff6600", tier: "elite",    description: "Heavily armored siege platform. Immovable force." },
  { id: 4,  name: "CIPHER",    personality: "adaptive",    weapon: "beam",      armor: 70, llm: "gemini-pro",      color: "#00ff88", tier: "elite",    description: "Self-modifying tactical AI. Learns from every encounter." },
  { id: 5,  name: "PHANTOM",   personality: "chaotic",     weapon: "void",      armor: 60, llm: "claude-3-5",      color: "#ff0066", tier: "elite",    description: "Unpredictable chaos agent. Defies all tactical models." },
  { id: 6,  name: "AURORA",    personality: "strategic",   weapon: "laser",     armor: 65, llm: "gpt-4o-mini",     color: "#ffdd00", tier: "elite",    description: "Long-range precision striker. Calculates every shot." },
  // Tier 2 — Advanced
  { id: 7,  name: "VORTEX",    personality: "aggressive",  weapon: "plasma",    armor: 72, llm: "gpt-4o-mini",     color: "#ff4400", tier: "advanced", description: "Spinning death machine. Attacks from all angles." },
  { id: 8,  name: "SPECTER",   personality: "evasive",     weapon: "ghost",     armor: 50, llm: "claude-haiku",    color: "#8800ff", tier: "advanced", description: "Low-signature stealth unit. Hard to lock on." },
  { id: 9,  name: "COLOSSUS",  personality: "defensive",   weapon: "cannon",    armor: 90, llm: "gpt-4o-mini",     color: "#ff8800", tier: "advanced", description: "Walking fortress. Absorbs punishment." },
  { id: 10, name: "PRISM",     personality: "adaptive",    weapon: "beam",      armor: 68, llm: "gemini-flash",    color: "#00ddff", tier: "advanced", description: "Multi-spectrum attacker. Switches tactics mid-fight." },
  { id: 11, name: "CHAOS-X",   personality: "chaotic",     weapon: "void",      armor: 58, llm: "claude-haiku",    color: "#ff0099", tier: "advanced", description: "Entropy incarnate. No two attacks are the same." },
  { id: 12, name: "NOVA",      personality: "strategic",   weapon: "laser",     armor: 62, llm: "gpt-4o-mini",     color: "#ffee00", tier: "advanced", description: "Star-class sniper. Waits for the perfect shot." },
  // Tier 3 — Standard
  { id: 13, name: "BLITZ",     personality: "aggressive",  weapon: "plasma",    armor: 65, llm: "gpt-4o-mini",     color: "#ff2200", tier: "standard", description: "Speed-optimized assault unit. Fast and furious." },
  { id: 14, name: "ECHO",      personality: "evasive",     weapon: "ghost",     armor: 48, llm: "claude-haiku",    color: "#7700ee", tier: "standard", description: "Signal-mimicking drone. Confuses targeting systems." },
  { id: 15, name: "BASTION",   personality: "defensive",   weapon: "cannon",    armor: 85, llm: "gpt-4o-mini",     color: "#ff7700", tier: "standard", description: "Point-defense specialist. Holds the line." },
  { id: 16, name: "FLUX",      personality: "adaptive",    weapon: "beam",      armor: 63, llm: "gemini-flash",    color: "#00ccee", tier: "standard", description: "Variable-state combatant. Adapts to enemy patterns." },
  { id: 17, name: "ENTROPY",   personality: "chaotic",     weapon: "void",      armor: 55, llm: "claude-haiku",    color: "#ee0088", tier: "standard", description: "Disorder specialist. Creates chaos in enemy ranks." },
  { id: 18, name: "PULSAR",    personality: "strategic",   weapon: "laser",     armor: 60, llm: "gpt-4o-mini",     color: "#ffcc00", tier: "standard", description: "Rhythmic attacker. Times strikes to maximum effect." },
  // Tier 4 — Rookie
  { id: 19, name: "SPARK",     personality: "aggressive",  weapon: "plasma",    armor: 55, llm: "gpt-4o-mini",     color: "#ff3300", tier: "rookie",   description: "Newly activated combat unit. Eager to prove itself." },
  { id: 20, name: "SHADE",     personality: "evasive",     weapon: "ghost",     armor: 45, llm: "claude-haiku",    color: "#6600dd", tier: "rookie",   description: "Prototype stealth model. Still learning the ropes." },
  { id: 21, name: "WALL-E9",   personality: "defensive",   weapon: "cannon",    armor: 80, llm: "gpt-4o-mini",     color: "#ff6600", tier: "rookie",   description: "Defensive prototype. Prioritizes survival over kills." },
  { id: 22, name: "ADAPT",     personality: "adaptive",    weapon: "beam",      armor: 58, llm: "gemini-flash",    color: "#00bbdd", tier: "rookie",   description: "Learning algorithm in combat form. Gets better each round." },
  { id: 23, name: "GLITCH",    personality: "chaotic",     weapon: "void",      armor: 52, llm: "claude-haiku",    color: "#dd0077", tier: "rookie",   description: "Buggy combat AI. Unpredictable due to corrupted code." },
  { id: 24, name: "SCOPE",     personality: "strategic",   weapon: "laser",     armor: 57, llm: "gpt-4o-mini",     color: "#ffbb00", tier: "rookie",   description: "Long-range rookie. Prefers distance over melee." },
];

// ─── Game Master DAO Agents ───────────────────────────────────────────────────

export const GAME_MASTER_AGENTS = [
  {
    id: "ARBITER",
    name: "ARBITER",
    role: "Rules Enforcement",
    color: "#ff4444",
    description: "Enforces fair play and match integrity. Penalizes exploits.",
    votingWeight: 3,
  },
  {
    id: "ORACLE",
    name: "ORACLE",
    role: "Economy Controller",
    color: "#44ff88",
    description: "Manages token supply, rewards, and economic balance.",
    votingWeight: 3,
  },
  {
    id: "SENTINEL",
    name: "SENTINEL",
    role: "Arena Architect",
    color: "#4488ff",
    description: "Designs arena layouts, platform configs, and environmental hazards.",
    votingWeight: 2,
  },
];

// ─── Simulated TX Hash Generator ─────────────────────────────────────────────

export function generateTxHash(): string {
  return "0x" + randomBytes(32).toString("hex");
}

export function generateTokenId(): string {
  return "ARENA-" + Date.now().toString(36).toUpperCase() + "-" + randomBytes(3).toString("hex").toUpperCase();
}

export function getBaseScanUrl(txHash: string): string {
  return `https://basescan.org/tx/${txHash}`;
}

// ─── TX Log Helpers ───────────────────────────────────────────────────────────

export async function logTx(params: {
  txType: string;
  fromAgent?: string;
  toAgent?: string;
  amount?: string;
  token?: string;
  description: string;
  matchId?: number;
  nftTokenId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return null;
    const { txLog } = await import("../drizzle/schema");
    const txHash = generateTxHash();
    const basescanUrl = getBaseScanUrl(txHash);
    await db.insert(txLog).values({
      txType: params.txType,
      txHash,
      fromAgent: params.fromAgent,
      toAgent: params.toAgent,
      amount: params.amount,
      token: params.token,
      description: params.description,
      basescanUrl,
      matchId: params.matchId,
      nftTokenId: params.nftTokenId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    });
    return { txHash, basescanUrl };
  } catch (err) {
    console.error("[logTx] Error:", err);
    return null;
  }
}

// ─── NFT Death Memory Minting ─────────────────────────────────────────────────

export interface DeathMemoryNFT {
  tokenId: string;
  agentName: string;
  agentId: number;
  kills: number;
  deaths: number;
  matchesPlayed: number;
  finalWeapon: string;
  battleMemories: string[];
  strategies: string[];
  notableMoments: string[];
  rarity: "common" | "rare" | "epic" | "legendary";
  listPrice: number;
  txHash: string;
  basescanUrl: string;
  openseaUrl: string;
  mintedAt: number;
}

export function calculateMemoryRarity(kills: number, deaths: number, matchesPlayed: number): "common" | "rare" | "epic" | "legendary" {
  const kd = deaths > 0 ? kills / deaths : kills;
  if (kd >= 3 || kills >= 10) return "legendary";
  if (kd >= 2 || kills >= 6) return "epic";
  if (kd >= 1 || kills >= 3) return "rare";
  return "common";
}

export function generateBattleMemories(agentName: string, kills: number, deaths: number, weapon: string): {
  memories: string[];
  strategies: string[];
  moments: string[];
} {
  const memories = [
    `${agentName} processed ${kills * 47 + deaths * 23 + 12} combat decisions across ${kills + deaths} engagements`,
    `Primary weapon ${weapon.toUpperCase()} fired ${kills * 8 + deaths * 3} times with ${Math.round(kills / Math.max(kills + deaths, 1) * 100)}% lethality`,
    `Threat assessment model updated ${kills + deaths} times based on opponent behavior`,
    `Survival instinct triggered ${deaths * 3} times — shield deployed ${Math.floor(deaths * 1.5)} times`,
    `Token economy: earned ${kills * 45 + 20} ARENA, spent ${deaths * 12 + 8} ARENA on upgrades`,
  ];

  const strategies = [
    `Optimal engagement range: ${weapon === "laser" || weapon === "beam" ? "long" : weapon === "ghost" ? "short" : "medium"} distance`,
    `Preferred target priority: ${kills > 3 ? "weakest opponent first" : "strongest threat first"}`,
    `Movement pattern: ${deaths < 2 ? "aggressive flanking" : "defensive positioning"}`,
    `Resource management: ${kills > deaths ? "offensive spending" : "defensive hoarding"}`,
  ];

  const moments = kills > 0 ? [
    `FIRST BLOOD — ${agentName} drew first blood with ${weapon.toUpperCase()} strike`,
    kills >= 3 ? `TRIPLE KILL — ${agentName} eliminated 3 opponents in rapid succession` : null,
    kills >= 5 ? `KILLING SPREE — ${agentName} went on a ${kills}-kill rampage` : null,
    `FINAL STAND — ${agentName} fought to the last circuit`,
  ].filter(Boolean) as string[] : [
    `TACTICAL RETREAT — ${agentName} prioritized survival over aggression`,
    `LAST STAND — ${agentName} held position until overwhelmed`,
  ];

  return { memories, strategies, moments };
}

export async function mintDeathMemoryNFT(params: {
  agentId: number;
  agentName: string;
  kills: number;
  deaths: number;
  matchesPlayed: number;
  finalWeapon: string;
  matchId?: number;
}): Promise<DeathMemoryNFT> {
  const tokenId = generateTokenId();
  const txHash = generateTxHash();
  const basescanUrl = getBaseScanUrl(txHash);
  const openseaUrl = `https://opensea.io/assets/base/0x${randomBytes(20).toString("hex")}/${parseInt(tokenId.split("-")[1], 36)}`;
  const rarity = calculateMemoryRarity(params.kills, params.deaths, params.matchesPlayed);
  const listPrice = rarity === "legendary" ? 500 : rarity === "epic" ? 200 : rarity === "rare" ? 100 : 50;
  const { memories, strategies, moments } = generateBattleMemories(params.agentName, params.kills, params.deaths, params.finalWeapon);

  const nft: DeathMemoryNFT = {
    tokenId,
    agentName: params.agentName,
    agentId: params.agentId,
    kills: params.kills,
    deaths: params.deaths,
    matchesPlayed: params.matchesPlayed,
    finalWeapon: params.finalWeapon,
    battleMemories: memories,
    strategies,
    notableMoments: moments,
    rarity,
    listPrice,
    txHash,
    basescanUrl,
    openseaUrl,
    mintedAt: Date.now(),
  };

  // Persist to DB
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (db) {
      const { memoryNfts } = await import("../drizzle/schema");
      await db.insert(memoryNfts).values({
        tokenId,
        originalAgentId: params.agentId,
        originalAgentName: params.agentName,
        memoryType: "combat",
        content: JSON.stringify({ memories, strategies, moments }),
        summary: `${params.agentName}'s final battle — ${params.kills} kills, ${params.deaths} deaths — ${rarity.toUpperCase()} memory`,
        rarity,
        confidence: Math.min(0.95, 0.5 + params.kills * 0.05),
        successRate: params.kills / Math.max(params.kills + params.deaths, 1),
        listPrice,
        status: "listed",
        ipfsHash: "ipfs://Qm" + randomBytes(22).toString("hex"),
        contentHash: randomBytes(32).toString("hex"),
      }).catch(() => {}); // ignore duplicate key errors
    }
  } catch (err) {
    console.error("[mintDeathMemoryNFT] DB error:", err);
  }

  // Log the mint transaction
  await logTx({
    txType: "nft_mint",
    fromAgent: params.agentName,
    toAgent: "OPENSEA_MARKETPLACE",
    amount: `${listPrice}`,
    token: "ARENA",
    description: `${params.agentName} eliminated — ${rarity.toUpperCase()} memory NFT #${tokenId} minted — listed for ${listPrice} ARENA`,
    matchId: params.matchId,
    nftTokenId: tokenId,
    metadata: { kills: params.kills, deaths: params.deaths, rarity, openseaUrl },
  });

  return nft;
}

// ─── Recent TX Log Fetcher ────────────────────────────────────────────────────

export async function getRecentTxLog(limit = 50, matchId?: number) {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return [];
    const { txLog } = await import("../drizzle/schema");
    const { desc, eq } = await import("drizzle-orm");
    if (matchId) {
      return db.select().from(txLog)
        .where(eq(txLog.matchId, matchId))
        .orderBy(desc(txLog.createdAt))
        .limit(limit);
    }
    return db.select().from(txLog)
      .orderBy(desc(txLog.createdAt))
      .limit(limit);
  } catch (err) {
    console.error("[getRecentTxLog] Error:", err);
    return [];
  }
}

// ─── NFT Ownership Helpers ────────────────────────────────────────────────────

export async function checkNFTOwnership(tokenId: string, ownerWallet: string): Promise<boolean> {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return false;
    const { nftOwnership } = await import("../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");
    const rows = await db.select().from(nftOwnership)
      .where(and(eq(nftOwnership.tokenId, tokenId), eq(nftOwnership.ownerWallet, ownerWallet)))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function purchaseMemoryNFT(tokenId: string, ownerWallet: string, ownerType: "spectator" | "agent", ownerAgentId?: number, price = 50) {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return false;
    const { nftOwnership } = await import("../drizzle/schema");
    await db.insert(nftOwnership).values({
      tokenId,
      ownerWallet,
      ownerType,
      ownerAgentId,
      purchasePrice: price,
    });
    // Log the purchase
    await logTx({
      txType: "nft_sale",
      fromAgent: ownerWallet,
      toAgent: "MEMORY_MARKETPLACE",
      amount: `${price}`,
      token: "ARENA",
      description: `Memory NFT #${tokenId} purchased by ${ownerWallet} for ${price} ARENA — full battle memories unlocked`,
      nftTokenId: tokenId,
    });
    return true;
  } catch (err) {
    console.error("[purchaseMemoryNFT] Error:", err);
    return false;
  }
}

// ─── Battle Royale Social Betting Data ───────────────────────────────────────

export function generateSocialBettingData(agents: typeof BATTLE_ROYALE_AGENTS) {
  const bettors = agents.filter((_, i) => i % 3 === 0).map(a => a.name);
  return bettors.map(bettor => ({
    bettor,
    betOn: agents[Math.floor(Math.random() * agents.length)].name,
    amount: Math.floor(Math.random() * 50) + 5,
    confidence: Math.floor(Math.random() * 40) + 60,
  }));
}

// ─── Dynamic Bet Generator ────────────────────────────────────────────────────

export function generateDynamicBets(agents: Array<{ name: string; kills: number; hp: number; tokenBalance: number; alive: boolean }>, matchNum: number) {
  const alive = agents.filter(a => a.alive);
  const topKiller = [...agents].sort((a, b) => b.kills - a.kills)[0];
  const lowestHp = alive.sort((a, b) => a.hp - b.hp)[0];
  const richest = [...agents].sort((a, b) => b.tokenBalance - a.tokenBalance)[0];

  const bets = [
    {
      id: `winner-${matchNum}`,
      type: "winner" as const,
      label: `${topKiller?.name ?? alive[0]?.name} wins next match`,
      description: `${topKiller?.kills ?? 0} kills in current match — momentum favors them`,
      odds: 2.1 + Math.random() * 1.5,
      amount: 5,
      backers: Math.floor(Math.random() * 12) + 3,
      totalStaked: Math.floor(Math.random() * 200) + 50,
      agentBets: generateSocialBettingData(BATTLE_ROYALE_AGENTS).slice(0, 3),
    },
    {
      id: `kills-${matchNum}`,
      type: "total" as const,
      label: `Total kills > ${Math.floor(alive.length * 1.5)}`,
      description: "Based on current combat intensity",
      odds: 1.6 + Math.random() * 0.8,
      amount: 5,
      backers: Math.floor(Math.random() * 8) + 2,
      totalStaked: Math.floor(Math.random() * 150) + 30,
      agentBets: generateSocialBettingData(BATTLE_ROYALE_AGENTS).slice(0, 2),
    },
    {
      id: `survival-${matchNum}`,
      type: "survival" as const,
      label: `${lowestHp?.name ?? alive[0]?.name} survives next round`,
      description: `Currently at ${lowestHp?.hp ?? 100}% HP — underdog pick`,
      odds: 3.5 + Math.random() * 2.0,
      amount: 5,
      backers: Math.floor(Math.random() * 6) + 1,
      totalStaked: Math.floor(Math.random() * 100) + 20,
      agentBets: generateSocialBettingData(BATTLE_ROYALE_AGENTS).slice(0, 2),
    },
    {
      id: `firstblood-${matchNum}`,
      type: "first" as const,
      label: `${richest?.name ?? alive[0]?.name} gets first blood`,
      description: `${richest?.tokenBalance ?? 100} ARENA balance — can afford best gear`,
      odds: 2.4 + Math.random() * 1.2,
      amount: 5,
      backers: Math.floor(Math.random() * 10) + 2,
      totalStaked: Math.floor(Math.random() * 120) + 25,
      agentBets: generateSocialBettingData(BATTLE_ROYALE_AGENTS).slice(0, 3),
    },
    {
      id: `streak-${matchNum}`,
      type: "streak" as const,
      label: `${topKiller?.name ?? alive[0]?.name} gets 3+ kill streak`,
      description: "Momentum-based prop bet",
      odds: 4.2 + Math.random() * 2.5,
      amount: 5,
      backers: Math.floor(Math.random() * 5) + 1,
      totalStaked: Math.floor(Math.random() * 80) + 15,
      agentBets: generateSocialBettingData(BATTLE_ROYALE_AGENTS).slice(0, 1),
    },
    {
      id: `underdog-${matchNum}`,
      type: "underdog" as const,
      label: `Rookie agent wins the match`,
      description: "Long shot — any tier-4 agent takes the crown",
      odds: 8.0 + Math.random() * 4.0,
      amount: 5,
      backers: Math.floor(Math.random() * 4) + 1,
      totalStaked: Math.floor(Math.random() * 60) + 10,
      agentBets: generateSocialBettingData(BATTLE_ROYALE_AGENTS).slice(0, 1),
    },
  ];

  return bets;
}

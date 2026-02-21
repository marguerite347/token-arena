/**
 * Polymarket Service
 *
 * Fetches external prediction market data from Polymarket's public API.
 * Agents use this data as an external signal to inform their betting decisions.
 * This creates the external acquisition funnel narrative: external bettors
 * discover Token Arena through Polymarket.
 *
 * Public endpoints (no auth needed for reading):
 *   - GET https://clob.polymarket.com/markets — list markets
 *   - GET https://clob.polymarket.com/markets/{id} — single market
 *   - GET https://clob.polymarket.com/prices-history — price history
 *
 * Authenticated endpoints use POLYMARKET_API_KEY.
 */

import { ENV } from "./_core/env";

const CLOB_BASE = "https://clob.polymarket.com";
const GAMMA_BASE = "https://gamma-api.polymarket.com";

export interface PolymarketMarket {
  condition_id: string;
  question: string;
  description?: string;
  end_date_iso?: string;
  active: boolean;
  closed: boolean;
  volume?: number;
  liquidity?: number;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
  category?: string;
  tags?: string[];
}

export interface PolymarketSignal {
  marketId: string;
  question: string;
  category: string;
  topOutcome: string;
  topOutcomePrice: number;
  confidence: number; // 0-100
  volume: number;
  relevanceScore: number; // How relevant to Token Arena battles
  agentInsight: string; // LLM-style insight for agent decision-making
}

/** Fetch trending/active markets from Polymarket */
export async function fetchPolymarketMarkets(limit = 20): Promise<PolymarketMarket[]> {
  try {
    const res = await fetch(
      `${GAMMA_BASE}/markets?active=true&closed=false&limit=${limit}&order=volume&ascending=false`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(ENV.POLYMARKET_API_KEY ? { "Authorization": `Bearer ${ENV.POLYMARKET_API_KEY}` } : {}),
        },
      }
    );
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    const data = await res.json();
    // Gamma API returns array directly or { markets: [...] }
    return Array.isArray(data) ? data : (data.markets ?? data.data ?? []);
  } catch (err) {
    console.error("[Polymarket] Failed to fetch markets:", err);
    return getMockMarkets();
  }
}

/** Fetch a specific market by condition ID */
export async function fetchPolymarketMarket(conditionId: string): Promise<PolymarketMarket | null> {
  try {
    const res = await fetch(`${CLOB_BASE}/markets/${conditionId}`, {
      headers: {
        "Content-Type": "application/json",
        ...(ENV.POLYMARKET_API_KEY ? { "Authorization": `Bearer ${ENV.POLYMARKET_API_KEY}` } : {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Convert Polymarket markets into agent-readable signals */
export function extractAgentSignals(markets: PolymarketMarket[]): PolymarketSignal[] {
  return markets
    .filter((m) => m.active && !m.closed && m.tokens?.length > 0)
    .slice(0, 10)
    .map((market) => {
      // Find the leading outcome
      const sorted = [...(market.tokens || [])].sort((a, b) => b.price - a.price);
      const top = sorted[0];
      const confidence = top ? Math.round(top.price * 100) : 50;

      // Score relevance to Token Arena (crypto/gaming/AI markets score higher)
      const q = (market.question || "").toLowerCase();
      const tags = (market.tags || []).join(" ").toLowerCase();
      const relevanceScore = scoreRelevance(q, tags);

      // Generate agent insight
      const agentInsight = generateInsight(market, top, confidence);

      return {
        marketId: market.condition_id,
        question: market.question,
        category: market.category || inferCategory(q),
        topOutcome: top?.outcome || "Yes",
        topOutcomePrice: top?.price || 0.5,
        confidence,
        volume: market.volume || 0,
        relevanceScore,
        agentInsight,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function scoreRelevance(question: string, tags: string): number {
  let score = 50;
  const cryptoTerms = ["bitcoin", "btc", "eth", "crypto", "defi", "nft", "token", "blockchain", "base", "uniswap"];
  const aiTerms = ["ai", "gpt", "llm", "openai", "anthropic", "agent", "model"];
  const gameTerms = ["game", "esport", "tournament", "battle", "arena", "win", "champion"];
  const marketTerms = ["price", "market", "trade", "volume", "liquidity"];

  for (const term of cryptoTerms) if (question.includes(term) || tags.includes(term)) score += 15;
  for (const term of aiTerms) if (question.includes(term) || tags.includes(term)) score += 12;
  for (const term of gameTerms) if (question.includes(term) || tags.includes(term)) score += 10;
  for (const term of marketTerms) if (question.includes(term) || tags.includes(term)) score += 5;

  return Math.min(100, score);
}

function inferCategory(question: string): string {
  if (/bitcoin|btc|eth|crypto|defi|nft|token/.test(question)) return "Crypto";
  if (/ai|gpt|llm|openai|anthropic/.test(question)) return "AI";
  if (/game|esport|sport|nfl|nba/.test(question)) return "Sports/Gaming";
  if (/election|president|vote|politic/.test(question)) return "Politics";
  return "General";
}

function generateInsight(market: PolymarketMarket, top: { outcome: string; price: number } | undefined, confidence: number): string {
  if (!top) return "Insufficient data for analysis.";
  const direction = confidence > 65 ? "strong consensus" : confidence > 50 ? "slight lean" : "uncertain";
  return `Market shows ${direction} toward "${top.outcome}" at ${confidence}% probability. ${
    market.volume && market.volume > 100000
      ? `High volume ($${(market.volume / 1000).toFixed(0)}K) suggests reliable signal.`
      : "Low volume — treat as weak signal."
  } ${
    confidence > 70
      ? "Consider aligning bets with market consensus for lower risk."
      : "High uncertainty — contrarian bet may have positive EV."
  }`;
}

/** Get mock markets for when API is unavailable */
function getMockMarkets(): PolymarketMarket[] {
  return [
    {
      condition_id: "mock-btc-100k",
      question: "Will Bitcoin reach $100,000 by end of Q1 2026?",
      active: true,
      closed: false,
      volume: 2500000,
      liquidity: 450000,
      category: "Crypto",
      tags: ["bitcoin", "crypto", "price"],
      tokens: [
        { token_id: "yes", outcome: "Yes", price: 0.72 },
        { token_id: "no", outcome: "No", price: 0.28 },
      ],
    },
    {
      condition_id: "mock-eth-merge",
      question: "Will Ethereum hit $5,000 in 2026?",
      active: true,
      closed: false,
      volume: 1800000,
      liquidity: 320000,
      category: "Crypto",
      tags: ["ethereum", "eth", "price"],
      tokens: [
        { token_id: "yes", outcome: "Yes", price: 0.58 },
        { token_id: "no", outcome: "No", price: 0.42 },
      ],
    },
    {
      condition_id: "mock-ai-agent",
      question: "Will an AI agent autonomously earn $1M in 2026?",
      active: true,
      closed: false,
      volume: 950000,
      liquidity: 180000,
      category: "AI",
      tags: ["ai", "agent", "autonomous"],
      tokens: [
        { token_id: "yes", outcome: "Yes", price: 0.41 },
        { token_id: "no", outcome: "No", price: 0.59 },
      ],
    },
    {
      condition_id: "mock-base-tvl",
      question: "Will Base L2 TVL exceed $10B in 2026?",
      active: true,
      closed: false,
      volume: 750000,
      liquidity: 140000,
      category: "Crypto",
      tags: ["base", "l2", "defi", "tvl"],
      tokens: [
        { token_id: "yes", outcome: "Yes", price: 0.63 },
        { token_id: "no", outcome: "No", price: 0.37 },
      ],
    },
    {
      condition_id: "mock-uniswap-v5",
      question: "Will Uniswap v5 launch before June 2026?",
      active: true,
      closed: false,
      volume: 620000,
      liquidity: 110000,
      category: "Crypto",
      tags: ["uniswap", "defi", "dex"],
      tokens: [
        { token_id: "yes", outcome: "Yes", price: 0.35 },
        { token_id: "no", outcome: "No", price: 0.65 },
      ],
    },
  ];
}

/** Get Polymarket signals for agent decision-making */
export async function getAgentMarketSignals(): Promise<PolymarketSignal[]> {
  const markets = await fetchPolymarketMarkets(30);
  return extractAgentSignals(markets);
}

/** Get a summary string for injecting into agent LLM prompts */
export async function getMarketSignalBriefing(): Promise<string> {
  try {
    const signals = await getAgentMarketSignals();
    if (!signals.length) return "No external market signals available.";

    const top3 = signals.slice(0, 3);
    const lines = top3.map(
      (s) => `• [${s.category}] "${s.question.slice(0, 60)}..." → ${s.topOutcome} @ ${s.confidence}% confidence`
    );
    return `External Polymarket Signals:\n${lines.join("\n")}\nUse these as external sentiment indicators for your betting strategy.`;
  } catch {
    return "External market signals unavailable.";
  }
}

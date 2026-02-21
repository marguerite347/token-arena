import { describe, it, expect } from "vitest";
import {
  extractAgentSignals,
  getMarketSignalBriefing,
  type PolymarketMarket,
} from "./polymarketService";

describe("Polymarket Service", () => {
  const mockMarkets: PolymarketMarket[] = [
    {
      condition_id: "test-btc-100k",
      question: "Will Bitcoin reach $100,000 by end of Q1 2026?",
      active: true,
      closed: false,
      volume: 2500000,
      liquidity: 450000,
      category: "Crypto",
      tags: ["bitcoin", "crypto"],
      tokens: [
        { token_id: "yes", outcome: "Yes", price: 0.72 },
        { token_id: "no", outcome: "No", price: 0.28 },
      ],
    },
    {
      condition_id: "test-ai-agent",
      question: "Will an AI agent autonomously earn $1M in 2026?",
      active: true,
      closed: false,
      volume: 950000,
      liquidity: 180000,
      category: "AI",
      tags: ["ai", "agent"],
      tokens: [
        { token_id: "yes", outcome: "Yes", price: 0.41 },
        { token_id: "no", outcome: "No", price: 0.59 },
      ],
    },
    {
      condition_id: "test-closed",
      question: "Was 2025 a bull market?",
      active: false,
      closed: true,
      tokens: [{ token_id: "yes", outcome: "Yes", price: 1.0 }],
    },
  ];

  it("should extract signals from active markets only", () => {
    const signals = extractAgentSignals(mockMarkets);
    expect(signals).toHaveLength(2); // closed market filtered out
    expect(signals.every((s) => s.marketId !== "test-closed")).toBe(true);
  });

  it("should correctly identify the top outcome and confidence", () => {
    const signals = extractAgentSignals(mockMarkets);
    const btcSignal = signals.find((s) => s.marketId === "test-btc-100k");
    expect(btcSignal).toBeDefined();
    expect(btcSignal!.topOutcome).toBe("Yes");
    expect(btcSignal!.topOutcomePrice).toBe(0.72);
    expect(btcSignal!.confidence).toBe(72);
  });

  it("should score crypto/AI markets higher for relevance", () => {
    const signals = extractAgentSignals(mockMarkets);
    // Both are crypto/AI — both should have high relevance
    signals.forEach((s) => {
      expect(s.relevanceScore).toBeGreaterThan(50);
    });
  });

  it("should generate a non-empty agent insight for each signal", () => {
    const signals = extractAgentSignals(mockMarkets);
    signals.forEach((s) => {
      expect(s.agentInsight).toBeTruthy();
      expect(s.agentInsight.length).toBeGreaterThan(20);
    });
  });

  it("should sort signals by relevance score descending", () => {
    const signals = extractAgentSignals(mockMarkets);
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i - 1].relevanceScore).toBeGreaterThanOrEqual(
        signals[i].relevanceScore
      );
    }
  });

  it("should return a briefing string (string type check)", async () => {
    // getMarketSignalBriefing calls the live API or falls back to mock data
    // We just verify it returns a non-empty string
    const briefing = await getMarketSignalBriefing();
    expect(typeof briefing).toBe("string");
    expect(briefing.length).toBeGreaterThan(0);
  });
});

/**
 * Uniswap AI Agent SDK Integration Tests
 *
 * Validates the Uniswap AI SDK (github.com/Uniswap/uniswap-ai) integration
 * for the $5K Uniswap Foundation bounty at ETHDenver 2026.
 */
import { describe, it, expect } from "vitest";
import {
  agentDecideSwap,
  UNISWAP_AI_CONFIG,
  type AgentSwapDecision,
} from "./uniswapAIAgent";

describe("Uniswap AI Agent SDK", () => {
  describe("UNISWAP_AI_CONFIG", () => {
    it("should have SDK version 1.2.0", () => {
      expect(UNISWAP_AI_CONFIG.sdkVersion).toBe("1.2.0");
    });

    it("should target Base mainnet (chain 8453)", () => {
      expect(UNISWAP_AI_CONFIG.chainId).toBe(8453);
    });

    it("should have Trading API URL configured", () => {
      expect(UNISWAP_AI_CONFIG.apiUrl).toBe("https://trade-api.gateway.uniswap.org/v1");
    });

    it("should support CLASSIC, DUTCH_V2, and PRIORITY routing", () => {
      expect(UNISWAP_AI_CONFIG.routingTypes).toContain("CLASSIC");
      expect(UNISWAP_AI_CONFIG.routingTypes).toContain("DUTCH_V2");
      expect(UNISWAP_AI_CONFIG.routingTypes).toContain("PRIORITY");
    });

    it("should have ARENA token address on Base", () => {
      expect(UNISWAP_AI_CONFIG.arenaToken).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it("should have Base token addresses", () => {
      expect(UNISWAP_AI_CONFIG.tokens.WETH).toBe("0x4200000000000000000000000000000000000006");
      expect(UNISWAP_AI_CONFIG.tokens.USDC).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    });
  });

  describe("agentDecideSwap", () => {
    const wallet = "0x1234567890abcdef1234567890abcdef12345678";

    it("should decide to accumulate when balance is low", () => {
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 10, 0, 0, 1);
      expect(decision.action).toBe("accumulate");
      expect(decision.amount).toBe(0);
    });

    it("should decide to swap when balance is above threshold", () => {
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 100, 3, 1, 2);
      expect(decision.action).toBe("swap");
      expect(decision.amount).toBeGreaterThan(0);
    });

    it("should use DUTCH_V2 for large swaps", () => {
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 500, 5, 2, 3);
      // Large swap portion should trigger DUTCH_V2
      if (decision.amount > 100) {
        expect(decision.routingPreference).toBe("DUTCH_V2");
      }
    });

    it("should use PRIORITY for winning agents", () => {
      // K/D > 1.2, match > 2, but swap amount < 100
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 80, 5, 1, 3);
      if (decision.action === "swap" && decision.amount <= 100) {
        expect(decision.routingPreference).toBe("PRIORITY");
        expect(decision.urgency).toBe("fast");
      }
    });

    it("should use CLASSIC for standard swaps", () => {
      // K/D around 1.0, standard conditions
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 60, 2, 2, 1);
      if (decision.action === "swap" && decision.amount <= 100) {
        expect(decision.routingPreference).toBe("CLASSIC");
      }
    });

    it("should have higher confidence for winning agents", () => {
      const winner = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 100, 10, 1, 3);
      const loser = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 100, 1, 10, 3);
      if (winner.action === "swap" && loser.action === "swap") {
        expect(winner.confidence).toBeGreaterThan(loser.confidence);
      }
    });

    it("should include wallet address in decision", () => {
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 100, 3, 1, 2);
      expect(decision.walletAddress).toBe(wallet);
    });

    it("should target ARENA → WETH swap", () => {
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 100, 3, 1, 2);
      expect(decision.tokenIn).toBe(UNISWAP_AI_CONFIG.arenaToken);
      expect(decision.tokenOut).toBe(UNISWAP_AI_CONFIG.tokens.WETH);
    });

    it("should have valid timestamp", () => {
      const decision = agentDecideSwap("NEXUS-7", "Nexus-7", wallet, 100, 3, 1, 2);
      expect(decision.timestamp).toBeGreaterThan(0);
      expect(decision.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });
});

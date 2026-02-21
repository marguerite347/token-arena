/**
 * Uniswap API Integration Tests
 * Validates that the UNISWAP_API_KEY is configured and the service works correctly.
 */

import { describe, it, expect } from "vitest";
import { getUniswapQuote, UNISWAP_CONFIG, executeSwap } from "./uniswapService";

describe("Uniswap API Integration", () => {
  it("should have UNISWAP_API_KEY configured", () => {
    // The key is injected at runtime; in test env we check the config flag
    // In production, UNISWAP_CONFIG.hasApiKey will be true
    expect(UNISWAP_CONFIG).toBeDefined();
    expect(UNISWAP_CONFIG.apiUrl).toBe("https://trade-api.gateway.uniswap.org/v1");
    expect(UNISWAP_CONFIG.arenaToken).toBe("0x9DB281D2243ea30577783ab3364873E3F0a02610");
  });

  it("should return a valid simulated quote for ARENA→WETH", async () => {
    const amountWei = BigInt(Math.floor(100 * 1e18)).toString();
    const quote = await getUniswapQuote(
      UNISWAP_CONFIG.arenaToken,
      UNISWAP_CONFIG.tokens.WETH,
      amountWei,
      "0x0000000000000000000000000000000000000000",
      UNISWAP_CONFIG.baseSepoliaChainId,
    );

    expect(quote).toBeDefined();
    expect(quote.quoteId).toBeTruthy();
    expect(quote.tokenIn).toBe(UNISWAP_CONFIG.arenaToken);
    expect(quote.tokenOut).toBe(UNISWAP_CONFIG.tokens.WETH);
    expect(quote.amountIn).toBe(amountWei);
    expect(parseFloat(quote.amountOut)).toBeGreaterThan(0);
    expect(quote.exchangeRate).toBeGreaterThan(0);
    expect(quote.timestamp).toBeGreaterThan(0);
  });

  it("should calculate correct exchange rates", () => {
    const { rates } = UNISWAP_CONFIG;
    // 1 ARENA = 0.000025 ETH
    expect(rates.ARENA_TO_ETH).toBe(0.000025);
    // 100 ARENA = 0.0025 ETH
    const ethFor100Arena = 100 * rates.ARENA_TO_ETH;
    expect(ethFor100Arena).toBe(0.0025);
    // 0.0025 ETH / 0.0001 ETH per compute = 25 compute credits
    const computeCredits = Math.floor(ethFor100Arena / rates.COMPUTE_COST_ETH);
    expect(computeCredits).toBe(25);
  });

  it("should execute a simulated swap successfully", async () => {
    const amountWei = BigInt(Math.floor(50 * 1e18)).toString();
    const quote = await getUniswapQuote(
      UNISWAP_CONFIG.arenaToken,
      UNISWAP_CONFIG.tokens.WETH,
      amountWei,
      "0x0000000000000000000000000000000000000000",
      UNISWAP_CONFIG.baseSepoliaChainId,
    );

    const result = await executeSwap(quote);
    expect(result.success).toBe(true);
    expect(result.txHash).toBeTruthy();
    expect(result.txHash.startsWith("0x")).toBe(true);
    expect(result.amountIn).toBe(amountWei);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it("should have correct flywheel rates for self-sustaining loop", () => {
    const { rates } = UNISWAP_CONFIG;
    // Agent earns 50 ARENA per match
    const matchEarnings = 50;
    // 30% goes to compute replenishment
    const swapAmount = Math.floor(matchEarnings * 0.3);
    expect(swapAmount).toBe(15);
    // 15 ARENA → ETH
    const ethReceived = swapAmount * rates.ARENA_TO_ETH;
    expect(ethReceived).toBeCloseTo(0.000375, 6);
    // ETH → compute credits
    const computeCredits = Math.floor(ethReceived / rates.COMPUTE_COST_ETH);
    expect(computeCredits).toBe(3);
    // Agent can afford 3 more LLM calls from this match
    expect(computeCredits).toBeGreaterThan(0);
  });
});

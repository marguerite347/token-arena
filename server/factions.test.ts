/**
 * Tests for Faction, Auction, Revival, and DAO Domain systems
 */
import { describe, it, expect } from "vitest";

// Test the revival cost calculation (pure function, no DB needed)
describe("Revival Cost Calculation", () => {
  it("should calculate correct revival costs based on reputation", async () => {
    const { calculateRevivalCost } = await import("./revivalService");

    expect(calculateRevivalCost(100)).toBe(200);   // Bronze
    expect(calculateRevivalCost(300)).toBe(200);   // Bronze
    expect(calculateRevivalCost(400)).toBe(400);   // Silver
    expect(calculateRevivalCost(600)).toBe(800);   // Gold
    expect(calculateRevivalCost(900)).toBe(2000);  // Legendary
    expect(calculateRevivalCost(1200)).toBe(2000); // Legendary
  });
});

// Test the domain config structure
describe("DAO Domain Config", () => {
  it("should have all 5 domains configured", async () => {
    const { DOMAIN_CONFIG } = await import("./daoDomainController");

    expect(Object.keys(DOMAIN_CONFIG)).toHaveLength(5);
    expect(DOMAIN_CONFIG).toHaveProperty("matchmaking");
    expect(DOMAIN_CONFIG).toHaveProperty("economy");
    expect(DOMAIN_CONFIG).toHaveProperty("arenas");
    expect(DOMAIN_CONFIG).toHaveProperty("rules");
    expect(DOMAIN_CONFIG).toHaveProperty("balance");
  });

  it("should map each domain to a council member", async () => {
    const { DOMAIN_CONFIG } = await import("./daoDomainController");

    expect(DOMAIN_CONFIG.matchmaking.councilMemberName).toBe("ARCHON");
    expect(DOMAIN_CONFIG.economy.councilMemberName).toBe("FORGE");
    expect(DOMAIN_CONFIG.arenas.councilMemberName).toBe("ENTROPY");
    expect(DOMAIN_CONFIG.rules.councilMemberName).toBe("JUSTICE");
    expect(DOMAIN_CONFIG.balance.councilMemberName).toBe("EQUILIBRIA");
  });

  it("should have actions for each domain", async () => {
    const { DOMAIN_CONFIG } = await import("./daoDomainController");

    for (const [domain, config] of Object.entries(DOMAIN_CONFIG)) {
      expect(config.actions.length).toBeGreaterThan(0);
      expect(config.description).toBeTruthy();
    }
  });
});

// Test OpenRouter model registry
describe("OpenRouter LLM Models", () => {
  it("should have all 6 models configured", async () => {
    const { LLM_MODELS } = await import("./openRouterLLM");

    expect(Object.keys(LLM_MODELS).length).toBeGreaterThanOrEqual(6);
  });

  it("should assign different models to agents 1-6", async () => {
    const { AGENT_MODEL_ASSIGNMENTS } = await import("./openRouterLLM");

    const models = new Set(Object.values(AGENT_MODEL_ASSIGNMENTS));
    expect(models.size).toBe(6); // All unique
  });

  it("should have valid model configs with required fields", async () => {
    const { LLM_MODELS } = await import("./openRouterLLM");

    for (const [key, config] of Object.entries(LLM_MODELS)) {
      expect(config.modelId).toBeTruthy();
      expect(config.displayName).toBeTruthy();
      expect(config.label).toBeTruthy();
      expect(config.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(config.icon).toBeTruthy();
      expect(config.personalityNote).toBeTruthy();
      expect(config.styleHint).toBeTruthy();
    }
  });

  it("should return correct model for each agent", async () => {
    const { getAgentModel, getAgentModelKey } = await import("./openRouterLLM");

    // Agent 1 should be Claude
    expect(getAgentModelKey(1)).toBe("claude-3-5-sonnet");
    const model1 = getAgentModel(1);
    expect(model1.label).toBe("Claude");

    // Agent 2 should be GPT-4o
    expect(getAgentModelKey(2)).toBe("gpt-4o");
    const model2 = getAgentModel(2);
    expect(model2.label).toBe("GPT-4o");
  });
});

// Test Uniswap service structure
describe("Uniswap Service", () => {
  it("should export required functions", async () => {
    const uniswap = await import("./uniswapService");

    expect(typeof uniswap.getUniswapQuote).toBe("function");
    expect(typeof uniswap.executeSwap).toBe("function");
    expect(typeof uniswap.agentFlywheelSwap).toBe("function");
    expect(typeof uniswap.purchaseCompute).toBe("function");
    expect(typeof uniswap.runFlywheelCycle).toBe("function");
  });

  it("should have correct Uniswap config", async () => {
    const { UNISWAP_CONFIG } = await import("./uniswapService");

    expect(UNISWAP_CONFIG.baseChainId).toBe(8453);
    expect(UNISWAP_CONFIG.apiUrl).toBeTruthy();
  });
});

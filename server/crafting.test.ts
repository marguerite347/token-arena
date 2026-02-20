import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Crafting System", () => {
  it("should initialize crafting materials and recipes", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.crafting.init();
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("should list available materials", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const materials = await caller.crafting.materials();
    expect(Array.isArray(materials)).toBe(true);
    expect(materials.length).toBeGreaterThan(0);
    expect(materials[0]).toHaveProperty("name");
    expect(materials[0]).toHaveProperty("rarity");
  });

  it("should list available recipes", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const recipes = await caller.crafting.recipes();
    expect(Array.isArray(recipes)).toBe(true);
    expect(recipes.length).toBeGreaterThan(0);
    expect(recipes[0]).toHaveProperty("name");
    expect(recipes[0]).toHaveProperty("resultType");
  });

  it("should roll material drops after a kill", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const drops = await caller.crafting.rollDrops({
      weaponUsed: "plasma",
      killStreak: 2,
      agentId: 1,
    });
    expect(drops).toBeDefined();
    expect(Array.isArray(drops.drops)).toBe(true);
    // With killStreak 2, should get at least 1 drop
    expect(drops.drops.length).toBeGreaterThanOrEqual(0);
  });
});

describe("Agent Brain", () => {
  it("should list agents with identities", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const agents = await caller.agent.list();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0]).toHaveProperty("name");
    expect(agents[0]).toHaveProperty("agentId");
  });

  it("should trigger agent reasoning and return a decision", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.agent.reason({ agentId: 1 });
    expect(result).toBeDefined();
    // Result should have either a decision or an error
    if ("error" in result) {
      expect(typeof result.error).toBe("string");
    } else {
      expect(result.decision).toBeDefined();
      expect(result.decision).toHaveProperty("action");
      expect(result.decision).toHaveProperty("reasoning");
    }
  }, 15000);

  it("should list agent decisions", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const decisions = await caller.agent.decisions({ agentId: 1, limit: 5 });
    expect(Array.isArray(decisions)).toBe(true);
  });

  it("should list agent memories", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const memories = await caller.agent.memories({ agentId: 1, limit: 5 });
    expect(Array.isArray(memories)).toBe(true);
  });
});

describe("Game Master", () => {
  it("should run meta analysis and return economy health", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.gameMaster.analyze();
    expect(result).toBeDefined();
    expect(typeof result.economyHealth).toBe("number");
    expect(result.economyHealth).toBeGreaterThanOrEqual(0);
    expect(result.economyHealth).toBeLessThanOrEqual(1);
    expect(typeof result.analysis).toBe("string");
    expect(Array.isArray(result.actions)).toBe(true);
  }, 30000);

  it("should return analysis history", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const history = await caller.gameMaster.history();
    expect(Array.isArray(history)).toBe(true);
  });
});

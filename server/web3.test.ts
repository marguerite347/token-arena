import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

describe("x402.log", () => {
  it("logs an x402 transaction and returns an id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.x402.log({
      paymentId: "test-x402-payment-001",
      txHash: "0xabc123def456",
      action: "shoot",
      tokenSymbol: "PLAS",
      amount: 3,
      fromAddress: "0x1111111111111111111111111111111111111111",
      toAddress: "0x2222222222222222222222222222222222222222",
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty("id");
  });
});

describe("x402.recent", () => {
  it("returns recent x402 transactions as an array", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.x402.recent({ limit: 10 });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("agent.list", () => {
  it("returns a list of agent identities with at least 6 default agents", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.agent.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(6);
    // Each agent should have required fields
    const agent = result[0];
    expect(agent).toHaveProperty("agentId");
    expect(agent).toHaveProperty("name");
  });
});

describe("agent.get", () => {
  it("returns a specific agent by numeric ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // First get the list to find a valid numeric ID
    const agents = await caller.agent.list();
    expect(agents.length).toBeGreaterThan(0);

    const firstId = agents[0].id;
    const result = await caller.agent.get({ agentId: firstId });

    expect(result).toBeDefined();
    if (result) {
      expect(result.id).toBe(firstId);
    }
  });
});

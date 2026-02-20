import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestContext(userId?: number): TrpcContext {
  const user = userId
    ? {
        id: userId,
        openId: `test-user-${userId}`,
        email: `test${userId}@example.com`,
        name: `Test User ${userId}`,
        loginMethod: "test",
        role: "user" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("prediction market", () => {
  it("creates a prediction market", async () => {
    const ctx = createTestContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prediction.createMarket({
      councilMemberId: 1,
      marketType: "winner",
      title: "Who will win the match?",
      description: "Predict the winner of the next arena match",
      options: [
        { id: 1, label: "NEXUS-7", odds: 2.5 },
        { id: 2, label: "PHANTOM", odds: 3.0 },
        { id: 3, label: "TITAN", odds: 2.0 },
      ],
    });

    expect(result).toBeDefined();
    expect(result.marketId).toBeDefined();
    expect(result.governanceCooldownUntil).toBeDefined();
  });

  it("lists open prediction markets", async () => {
    const ctx = createTestContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prediction.open();

    expect(Array.isArray(result)).toBe(true);
  });

  it("places a bet on a prediction market", async () => {
    const ctx = createTestContext(1);
    const caller = appRouter.createCaller(ctx);

    // Create a market first
    const market = await caller.prediction.createMarket({
      councilMemberId: 1,
      marketType: "total_kills",
      title: "Total kills over 10?",
      description: "Will total kills exceed 10 in this match?",
      options: [
        { id: 1, label: "Yes", odds: 1.8 },
        { id: 2, label: "No", odds: 2.2 },
      ],
    });

    // Place a bet
    const bet = await caller.prediction.bet({
      marketId: market.marketId,
      bettorType: "player",
      bettorId: "test-player-1",
      bettorName: "Test Player",
      optionId: 1,
      amount: 10,
    });

    expect(bet).toBeDefined();
    expect(bet.betId).toBeDefined();
    expect(bet.potentialPayout).toBeDefined();
  });

  it("checks governance cooldown", async () => {
    const ctx = createTestContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.prediction.cooldown();

    expect(result).toBeDefined();
    expect(typeof result.active).toBe("boolean");
  });
});

describe("ecosystem snapshots", () => {
  it("captures an ecosystem snapshot", async () => {
    const ctx = createTestContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ecosystem.snapshot();

    expect(result).toBeDefined();
  });

  it("retrieves ecosystem history", async () => {
    const ctx = createTestContext(1);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ecosystem.history();

    expect(Array.isArray(result)).toBe(true);
  });
});

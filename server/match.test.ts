import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("match.save", () => {
  it("should save a match and return an id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.match.save({
      mode: "pvai",
      duration: 120,
      playerName: "TEST_PLAYER",
      playerKills: 5,
      playerDeaths: 1,
      tokensEarned: 150,
      tokensSpent: 80,
      tokenNet: 70,
      result: "victory",
      weaponUsed: "plasma",
    });

    expect(result).toHaveProperty("id");
  });
});

describe("match.recent", () => {
  it("should return an array of recent matches", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.match.recent({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("leaderboard.get", () => {
  it("should return an array of leaderboard entries", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.leaderboard.get({});
    expect(Array.isArray(result)).toBe(true);
    // Should have at least the test player from match.save test
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("playerName");
      expect(result[0]).toHaveProperty("totalKills");
      expect(result[0]).toHaveProperty("totalMatches");
    }
  });
});

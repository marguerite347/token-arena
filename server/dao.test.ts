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

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-dao-user",
      email: "dao@test.com",
      name: "DAO Tester",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("DAO Governance", () => {
  it("initializes the DAO council and fee structure", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.dao.init();
    expect(result).toBeDefined();
    expect(result.councilMembers).toBeDefined();
    expect(result.fees).toBeDefined();
  });

  it("returns the 5 council members with philosophies", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const council = await caller.dao.council();
    expect(council).toHaveLength(5);
    expect(council[0].name).toBe("ARCHON");
    expect(council[0].philosophy).toBe("growth");
    expect(council[4].name).toBe("FORGE");
    expect(council[4].philosophy).toBe("innovation");
  });

  it("returns the fee configuration", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const fees = await caller.dao.fees();
    expect(fees.length).toBeGreaterThan(0);
    const matchFee = fees.find(f => f.feeType === "match_entry");
    expect(matchFee).toBeDefined();
    expect(matchFee!.rate).toBeGreaterThan(0);
  });

  it("calculates fees correctly", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.dao.calculateFee({ feeType: "match_entry", baseAmount: 100 });
    expect(result.fee).toBeGreaterThan(0);
  });

  it("records a fee to the treasury", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.dao.recordFee({
      txType: "test_fee",
      amount: 50,
      description: "Test fee from vitest",
    });
    expect(result.success).toBe(true);
  });

  it("returns treasury balance", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const treasury = await caller.dao.treasury();
    expect(treasury).toBeDefined();
    expect(typeof treasury.balance).toBe("number");
    expect(treasury.balance).toBeGreaterThanOrEqual(0);
  });

  it("runs council deliberation with LLM-powered voting", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.dao.deliberate({
      proposalType: "economy_intervention",
      context: "Token inflation is rising. The economy needs rebalancing.",
    });
    expect(result).toBeDefined();
    expect(result.proposal).toBeDefined();
    expect(result.votes).toBeDefined();
    expect(result.votes.length).toBeGreaterThan(0);
    expect(["passed", "rejected"]).toContain(result.result);
  }, 30000);

  it("allows player voting on proposals", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    // First create a proposal via deliberation
    const deliberation = await caller.dao.deliberate({
      proposalType: "new_item",
      context: "The meta is stale. Consider introducing a new weapon.",
    });
    
    if (deliberation.proposal?.id) {
      const voteResult = await caller.dao.playerVote({
        proposalId: deliberation.proposal.id,
        vote: "for",
        arenaBalance: 200,
      });
      expect(voteResult).toBeDefined();
    }
  }, 30000);

  it("returns ecosystem state", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const ecosystem = await caller.dao.ecosystem();
    expect(ecosystem).toBeDefined();
    expect(ecosystem.agents).toBeDefined();
    expect(typeof ecosystem.agents.alive).toBe("number");
    expect(ecosystem.proposals).toBeDefined();
  });
});

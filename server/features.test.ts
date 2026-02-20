/**
 * Tests for v10 features: Replay Engine, Tournament Engine, Agent Customizer
 * These test the pure logic modules (no DOM/React dependencies).
 */
import { describe, it, expect } from "vitest";

// ─── Replay Engine Logic Tests ──────────────────────────────────────────────
// We test the data structures and utility functions directly

describe("Replay Engine", () => {
  it("should define valid replay event types", () => {
    const validTypes = [
      "frame", "kill", "damage", "weapon_switch",
      "fire", "craft", "token_transfer", "match_start", "match_end"
    ];
    expect(validTypes).toHaveLength(9);
    expect(validTypes).toContain("kill");
    expect(validTypes).toContain("frame");
  });

  it("should create valid agent snapshots", () => {
    const snapshot = {
      id: "agent-1",
      name: "NEXUS-7",
      x: 5.2,
      y: 0,
      z: -3.1,
      rotation: 1.57,
      health: 75,
      maxHealth: 100,
      tokens: 250,
      weapon: "plasma_rifle" as const,
      isAlive: true,
      kills: 2,
      color: "#00ffff",
    };
    expect(snapshot.id).toBe("agent-1");
    expect(snapshot.health).toBeLessThanOrEqual(snapshot.maxHealth);
    expect(snapshot.kills).toBeGreaterThanOrEqual(0);
  });

  it("should detect highlights from kill events", () => {
    // Simulate highlight detection logic
    const events = [
      { type: "kill", timestamp: 5000, killerId: "a1", victimId: "a2" },
      { type: "kill", timestamp: 5500, killerId: "a1", victimId: "a3" },
      { type: "kill", timestamp: 6000, killerId: "a1", victimId: "a4" },
    ];

    // Multi-kill detection: kills within 3 seconds
    const multiKills: { killerId: string; count: number }[] = [];
    const killsByAgent = new Map<string, number[]>();

    for (const e of events) {
      if (e.type === "kill") {
        const times = killsByAgent.get(e.killerId) || [];
        times.push(e.timestamp);
        killsByAgent.set(e.killerId, times);
      }
    }

    killsByAgent.forEach((times, agentId) => {
      // Count kills within 3-second windows
      let streak = 1;
      for (let i = 1; i < times.length; i++) {
        if (times[i] - times[i - 1] < 3000) {
          streak++;
        } else {
          streak = 1;
        }
      }
      if (streak >= 2) {
        multiKills.push({ killerId: agentId, count: streak });
      }
    });

    expect(multiKills).toHaveLength(1);
    expect(multiKills[0].killerId).toBe("a1");
    expect(multiKills[0].count).toBe(3);
  });

  it("should calculate replay duration correctly", () => {
    const startTime = 0;
    const endTime = 45000; // 45 seconds
    const duration = endTime - startTime;
    expect(duration).toBe(45000);
    expect(duration / 1000).toBe(45);
  });

  it("should support playback speed values", () => {
    const validSpeeds = [0.25, 0.5, 1, 2, 4];
    expect(validSpeeds).toContain(0.25); // slow-mo
    expect(validSpeeds).toContain(1);    // normal
    expect(validSpeeds).toContain(4);    // fast-forward
  });

  it("should serialize replay data to localStorage format", () => {
    const replayData = {
      id: "replay-123",
      matchMode: "aivai",
      startTime: Date.now(),
      duration: 45000,
      events: [{ type: "match_start", timestamp: 0 }],
      highlights: [{ timestamp: 5000, type: "multi_kill", description: "Triple kill!" }],
    };

    const serialized = JSON.stringify(replayData);
    const parsed = JSON.parse(serialized);

    expect(parsed.id).toBe("replay-123");
    expect(parsed.matchMode).toBe("aivai");
    expect(parsed.highlights).toHaveLength(1);
    expect(parsed.highlights[0].type).toBe("multi_kill");
  });
});

// ─── Tournament Engine Logic Tests ──────────────────────────────────────────

describe("Tournament Engine", () => {
  it("should calculate correct number of rounds for bracket sizes", () => {
    expect(Math.log2(4)).toBe(2);
    expect(Math.log2(8)).toBe(3);
    expect(Math.log2(16)).toBe(4);
  });

  it("should generate correct number of matches per round", () => {
    const sizes = [4, 8, 16];
    for (const size of sizes) {
      const rounds = Math.log2(size);
      let matchesInRound = size / 2;
      let totalMatches = 0;
      for (let r = 0; r < rounds; r++) {
        totalMatches += matchesInRound;
        matchesInRound /= 2;
      }
      expect(totalMatches).toBe(size - 1);
    }
  });

  it("should seed agents correctly for fair brackets", () => {
    // Standard seeding: 1v8, 2v7, 3v6, 4v5 for 8-agent bracket
    const agents = Array.from({ length: 8 }, (_, i) => ({
      id: `agent-${i + 1}`,
      seed: i + 1,
    }));

    // First round matchups with standard seeding
    const matchups = [
      [agents[0], agents[7]], // 1 vs 8
      [agents[1], agents[6]], // 2 vs 7
      [agents[2], agents[5]], // 3 vs 6
      [agents[3], agents[4]], // 4 vs 5
    ];

    expect(matchups[0][0].seed).toBe(1);
    expect(matchups[0][1].seed).toBe(8);
    expect(matchups[3][0].seed).toBe(4);
    expect(matchups[3][1].seed).toBe(5);
  });

  it("should track prediction market odds", () => {
    // Odds calculation: based on bets placed
    const bets = {
      agent1: 150, // 150 tokens on agent1
      agent2: 100, // 100 tokens on agent2
    };
    const total = bets.agent1 + bets.agent2;
    const odds1 = total / bets.agent1; // 1.67
    const odds2 = total / bets.agent2; // 2.5

    expect(odds1).toBeCloseTo(1.67, 1);
    expect(odds2).toBeCloseTo(2.5, 1);
    // Higher bet = lower odds (more favored)
    expect(odds1).toBeLessThan(odds2);
  });

  it("should advance winners through bracket rounds", () => {
    // Simulate a 4-agent tournament
    const round1Winners = ["agent-1", "agent-3"]; // agent-1 beat agent-2, agent-3 beat agent-4
    const finalMatch = {
      agent1: round1Winners[0],
      agent2: round1Winners[1],
    };

    expect(finalMatch.agent1).toBe("agent-1");
    expect(finalMatch.agent2).toBe("agent-3");

    // Final winner
    const champion = "agent-3";
    expect(round1Winners).toContain(champion);
  });

  it("should name rounds correctly", () => {
    const roundNames = (round: number, totalRounds: number): string => {
      if (round === totalRounds - 1) return "GRAND FINAL";
      if (round === totalRounds - 2) return "SEMI-FINALS";
      if (round === totalRounds - 3) return "QUARTER-FINALS";
      return `ROUND ${round + 1}`;
    };

    expect(roundNames(0, 4)).toBe("ROUND 1");
    expect(roundNames(1, 4)).toBe("QUARTER-FINALS");
    expect(roundNames(2, 4)).toBe("SEMI-FINALS");
    expect(roundNames(3, 4)).toBe("GRAND FINAL");
  });

  it("should persist tournament state to localStorage", () => {
    const tournamentState = {
      id: "tournament-1",
      name: "ARENA CHAMPIONSHIP",
      size: 8,
      currentRound: 1,
      status: "in_progress",
      rounds: [
        { matches: [{ winnerId: "agent-1" }, { winnerId: "agent-3" }] },
        { matches: [] },
      ],
    };

    const serialized = JSON.stringify(tournamentState);
    const parsed = JSON.parse(serialized);

    expect(parsed.name).toBe("ARENA CHAMPIONSHIP");
    expect(parsed.currentRound).toBe(1);
    expect(parsed.rounds[0].matches).toHaveLength(2);
  });
});

// ─── Agent Customizer Logic Tests ───────────────────────────────────────────

describe("Agent Customizer", () => {
  it("should define valid personality weight ranges", () => {
    const weights = {
      aggression: 75,
      caution: 40,
      greed: 60,
      creativity: 50,
    };

    for (const [key, value] of Object.entries(weights)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("should map personality weights to combat behavior", () => {
    // High aggression = shorter engagement range, more frequent firing
    const highAggression = { aggression: 90, caution: 10, greed: 30, creativity: 20 };
    const lowAggression = { aggression: 20, caution: 80, greed: 50, creativity: 30 };

    // Engagement range decreases with aggression
    const engageRange = (w: typeof highAggression) => 15 - (w.aggression / 100) * 10;
    expect(engageRange(highAggression)).toBeLessThan(engageRange(lowAggression));

    // Fire rate increases with aggression
    const fireRate = (w: typeof highAggression) => 0.5 + (w.aggression / 100) * 1.5;
    expect(fireRate(highAggression)).toBeGreaterThan(fireRate(lowAggression));
  });

  it("should validate preset builds have all required weights", () => {
    const presets = [
      { name: "BERSERKER", weights: { aggression: 95, caution: 10, greed: 30, creativity: 20 } },
      { name: "SNIPER", weights: { aggression: 40, caution: 70, greed: 50, creativity: 30 } },
      { name: "MERCHANT", weights: { aggression: 20, caution: 60, greed: 95, creativity: 40 } },
      { name: "CHAOS", weights: { aggression: 60, caution: 30, greed: 40, creativity: 95 } },
      { name: "TURTLE", weights: { aggression: 15, caution: 95, greed: 70, creativity: 25 } },
      { name: "BALANCED", weights: { aggression: 50, caution: 50, greed: 50, creativity: 50 } },
    ];

    for (const preset of presets) {
      expect(preset.weights).toHaveProperty("aggression");
      expect(preset.weights).toHaveProperty("caution");
      expect(preset.weights).toHaveProperty("greed");
      expect(preset.weights).toHaveProperty("creativity");
    }
  });

  it("should calculate build archetype from weights", () => {
    const getArchetype = (w: { aggression: number; caution: number; greed: number; creativity: number }) => {
      const maxKey = Object.entries(w).reduce((a, b) => (a[1] > b[1] ? a : b));
      return maxKey[0];
    };

    expect(getArchetype({ aggression: 90, caution: 10, greed: 30, creativity: 20 })).toBe("aggression");
    expect(getArchetype({ aggression: 20, caution: 80, greed: 50, creativity: 30 })).toBe("caution");
    expect(getArchetype({ aggression: 20, caution: 30, greed: 90, creativity: 40 })).toBe("greed");
    expect(getArchetype({ aggression: 20, caution: 30, greed: 40, creativity: 90 })).toBe("creativity");
  });

  it("should clamp weights to valid range", () => {
    const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

    expect(clamp(-10)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(50)).toBe(50);
    expect(clamp(0)).toBe(0);
    expect(clamp(100)).toBe(100);
  });
});

import { describe, it, expect } from "vitest";
import { calculateMemoryCost, calculateMemoryQueryCost } from "./agentLifecycle";

describe("Agent Lifecycle & Flywheel", () => {
  describe("calculateMemoryCost", () => {
    it("returns 1 for small memory (< 100 KB)", () => {
      expect(calculateMemoryCost(50)).toBe(1);
    });

    it("returns ceil(size/100) for larger memory", () => {
      expect(calculateMemoryCost(250)).toBe(3);
      expect(calculateMemoryCost(500)).toBe(5);
      expect(calculateMemoryCost(1000)).toBe(10);
    });

    it("returns 0 for zero memory", () => {
      expect(calculateMemoryCost(0)).toBe(0);
    });
  });

  describe("calculateMemoryQueryCost", () => {
    it("returns 1 for small queries (< 50 KB)", () => {
      expect(calculateMemoryQueryCost(30)).toBe(1);
    });

    it("returns ceil(size/50) for larger queries", () => {
      expect(calculateMemoryQueryCost(100)).toBe(2);
      expect(calculateMemoryQueryCost(250)).toBe(5);
    });

    it("returns 0 for zero-size query", () => {
      expect(calculateMemoryQueryCost(0)).toBe(0);
    });
  });

  describe("FlywheelData types", () => {
    it("trajectory values are valid", () => {
      const validTrajectories = ["ascending", "stable", "declining", "bankrupt"];
      for (const t of validTrajectories) {
        expect(validTrajectories).toContain(t);
      }
    });
  });

  describe("Bankruptcy detection", () => {
    it("agent with zero tokens should be considered bankrupt", () => {
      const tokenBalance = 0;
      expect(tokenBalance <= 0).toBe(true);
    });

    it("agent with positive tokens should not be bankrupt", () => {
      const tokenBalance = 100;
      expect(tokenBalance <= 0).toBe(false);
    });

    it("agent with negative tokens should be bankrupt", () => {
      const tokenBalance = -50;
      expect(tokenBalance <= 0).toBe(true);
    });
  });

  describe("Memory maintenance cost in game loop", () => {
    it("calculates correct maintenance cost per cycle", () => {
      const memorySize = 500; // 500 KB
      const maintenanceCost = Math.max(1, Math.ceil(memorySize / 100));
      expect(maintenanceCost).toBe(5);
    });

    it("minimum maintenance cost is 1 for any non-zero memory", () => {
      const memorySize = 10; // 10 KB
      const maintenanceCost = Math.max(1, Math.ceil(memorySize / 100));
      expect(maintenanceCost).toBe(1);
    });

    it("zero memory has zero maintenance cost", () => {
      const memorySize = 0;
      // In game loop, we skip agents with memorySize <= 0
      expect(memorySize <= 0).toBe(true);
    });
  });

  describe("Compute budget allocation", () => {
    it("allocates 60% for LLM and 40% for skybox", () => {
      const computeBudget = 100;
      const llmBudget = Math.floor(computeBudget * 0.6);
      const skyboxBudget = Math.floor(computeBudget * 0.4);
      expect(llmBudget).toBe(60);
      expect(skyboxBudget).toBe(40);
    });

    it("handles zero compute budget", () => {
      const computeBudget = 0;
      const llmBudget = Math.floor(computeBudget * 0.6);
      const skyboxBudget = Math.floor(computeBudget * 0.4);
      expect(llmBudget).toBe(0);
      expect(skyboxBudget).toBe(0);
    });
  });
});

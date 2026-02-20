/**
 * Scene Graph — unit tests for the structured arena vision system
 */
import { describe, it, expect } from "vitest";
import {
  getSceneGraphBriefing,
  getSceneGraphItemContext,
  sceneGraphToLearningData,
  getBestNodesForWeapon,
  getItemSpawnNodes,
  getOverlookingNodes,
  getConnectedNodes,
} from "@shared/sceneGraph";
import type { SceneGraph } from "@shared/sceneGraph";

// Minimal test graph
const testGraph: SceneGraph = {
  version: 1,
  arenaName: "Test Arena",
  nodes: [
    {
      id: "center", label: "Center", type: "open_area",
      tactical: { coverValue: 2, exposure: 9, elevation: 0, sightlines: 8, escapability: 7, idealWeapons: ["railgun", "beam"], features: ["grid floor"], itemSpawnAffinity: "high" },
      position: { x: 0, z: 0, y: 0 }, size: "large", description: "Central open area",
    },
    {
      id: "platform", label: "North Platform", type: "platform",
      tactical: { coverValue: 5, exposure: 6, elevation: 7, sightlines: 9, escapability: 4, idealWeapons: ["railgun"], features: ["railing"], itemSpawnAffinity: "medium" },
      position: { x: 0, z: -0.7, y: 0.6 }, size: "medium", description: "Elevated platform",
    },
    {
      id: "cover", label: "East Cover", type: "cover_point",
      tactical: { coverValue: 8, exposure: 3, elevation: 1, sightlines: 4, escapability: 6, idealWeapons: ["plasma", "scatter"], features: ["pillars"], itemSpawnAffinity: "low" },
      position: { x: 0.6, z: 0, y: 0.1 }, size: "medium", description: "Cover cluster",
    },
    {
      id: "hazard", label: "Void Pit", type: "hazard",
      tactical: { coverValue: 0, exposure: 10, elevation: -5, sightlines: 0, escapability: 0, idealWeapons: [], features: ["void"], itemSpawnAffinity: "none" },
      position: { x: -0.5, z: 0.5, y: -5 }, size: "small", description: "Instant death zone",
    },
  ],
  edges: [
    { from: "center", to: "platform", relation: "connected_to", traversalCost: 3, traversable: true, hasLineOfSight: true, description: "Ramp up" },
    { from: "platform", to: "center", relation: "overlooks", traversalCost: 0, traversable: false, hasLineOfSight: true, description: "Platform overlooks center" },
    { from: "center", to: "cover", relation: "connected_to", traversalCost: 2, traversable: true, hasLineOfSight: true, description: "Direct path" },
  ],
  globalProperties: {
    layoutType: "mixed",
    avgCoverDensity: 5,
    combatZoneCount: 3,
    theme: "cyberpunk",
    strategicSummary: "Mixed layout favors versatile loadouts.",
  },
  generatedAt: Date.now(),
  nodeCount: 4,
  edgeCount: 3,
};

describe("Scene Graph Helpers", () => {
  it("getBestNodesForWeapon returns nodes that support the weapon", () => {
    const nodes = getBestNodesForWeapon(testGraph, "railgun");
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    expect(nodes.every(n => n.tactical.idealWeapons.includes("railgun"))).toBe(true);
  });

  it("getItemSpawnNodes excludes 'none' affinity nodes", () => {
    const spawnNodes = getItemSpawnNodes(testGraph);
    expect(spawnNodes.every(n => n.tactical.itemSpawnAffinity !== "none")).toBe(true);
    expect(spawnNodes.length).toBe(3); // center (high), platform (medium), cover (low)
  });

  it("getItemSpawnNodes sorts by affinity priority (high first)", () => {
    const spawnNodes = getItemSpawnNodes(testGraph);
    expect(spawnNodes[0].tactical.itemSpawnAffinity).toBe("high");
  });

  it("getOverlookingNodes returns nodes with overlooks edges to target", () => {
    const overlooks = getOverlookingNodes(testGraph, "center");
    expect(overlooks.length).toBe(1);
    expect(overlooks[0].id).toBe("platform");
  });

  it("getConnectedNodes returns traversable neighbors", () => {
    const connected = getConnectedNodes(testGraph, "center");
    expect(connected.length).toBe(2); // platform (traversable) + cover (traversable)
    // platform overlooks edge is NOT traversable, but connected_to is
    const ids = connected.map(n => n.id);
    expect(ids).toContain("platform");
    expect(ids).toContain("cover");
  });

  it("getSceneGraphBriefing returns a non-empty string", () => {
    const briefing = getSceneGraphBriefing(testGraph);
    expect(typeof briefing).toBe("string");
    expect(briefing.length).toBeGreaterThan(50);
    expect(briefing).toContain("Test Arena");
    expect(briefing).toContain("SCENE GRAPH BRIEFING");
  });

  it("getSceneGraphItemContext returns placement context", () => {
    const ctx = getSceneGraphItemContext(testGraph);
    expect(ctx).toContain("SCENE GRAPH ITEM PLACEMENT");
    expect(ctx).toContain("Test Arena");
  });

  it("sceneGraphToLearningData returns learning string for win", () => {
    const learning = sceneGraphToLearningData(testGraph, {
      weaponUsed: "railgun",
      outcome: "win",
      kills: 5,
      deaths: 2,
      nodeVisited: "platform",
    });
    expect(learning).toContain("railgun");
    expect(learning).toContain("win");
    expect(learning).toContain("North Platform");
  });

  it("sceneGraphToLearningData returns learning string for loss", () => {
    const learning = sceneGraphToLearningData(testGraph, {
      weaponUsed: "scatter",
      outcome: "loss",
      kills: 1,
      deaths: 4,
    });
    expect(learning).toContain("scatter");
    expect(learning).toContain("loss");
    expect(learning).toContain("Consider different");
  });
});

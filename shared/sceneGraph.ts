/**
 * Scene Graph Types — Structured spatial representation of arena environments
 *
 * Instead of just text descriptions, the vision LLM outputs a JSON scene graph
 * with nodes (elements like platforms, corridors, cover points) and edges
 * (spatial relationships between them). This enables:
 *   - Agent pathfinding and strategy decisions
 *   - Game master contextual item placement
 *   - Post-match learning data for agent memory
 */

// ─── Node Types ─────────────────────────────────────────────────────────────

export type NodeType =
  | "platform"       // Elevated surface, sniper advantage
  | "corridor"       // Narrow passage, ambush risk
  | "open_area"      // Wide space, exposed but mobile
  | "cover_point"    // Defensive position with partial protection
  | "chokepoint"     // Narrow bottleneck between areas
  | "spawn_zone"     // Agent/item spawn location
  | "hazard"         // Environmental danger (lava, electricity, void)
  | "vantage_point"  // High ground with wide sightlines
  | "junction"       // Intersection of multiple paths
  | "dead_end";      // Single-entry area, risky but defensible

export interface TacticalProperties {
  /** 0-10: How much cover this node provides */
  coverValue: number;
  /** 0-10: How exposed agents are at this node */
  exposure: number;
  /** 0-10: Height advantage (0 = ground, 10 = highest point) */
  elevation: number;
  /** 0-10: How many sightlines converge here */
  sightlines: number;
  /** 0-10: How easy it is to escape from this node */
  escapability: number;
  /** Best weapons for fighting at/from this node */
  idealWeapons: string[];
  /** Environmental features present (steam, neon, pipes, etc.) */
  features: string[];
  /** Whether items should spawn here and why */
  itemSpawnAffinity: "none" | "low" | "medium" | "high";
}

export interface SceneNode {
  /** Unique identifier (e.g., "platform-north-1") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Node classification */
  type: NodeType;
  /** Tactical assessment */
  tactical: TacticalProperties;
  /** Approximate position in arena (normalized -1 to 1) */
  position: { x: number; z: number; y: number };
  /** Size estimate (small/medium/large) */
  size: "small" | "medium" | "large";
  /** Brief description of what this area looks like */
  description: string;
}

// ─── Edge Types ─────────────────────────────────────────────────────────────

export type EdgeRelation =
  | "connected_to"     // Direct path between nodes
  | "overlooks"        // One node has line-of-sight advantage over another
  | "adjacent_to"      // Nearby but no direct path
  | "above"            // Vertically above
  | "below"            // Vertically below
  | "leads_to"         // One-way or preferred direction
  | "blocks_view_of";  // This edge represents visual obstruction

export interface SceneEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Spatial relationship type */
  relation: EdgeRelation;
  /** Estimated traversal difficulty (0-10, 0 = trivial) */
  traversalCost: number;
  /** Can agents move along this edge? */
  traversable: boolean;
  /** Is there line-of-sight along this edge? */
  hasLineOfSight: boolean;
  /** Brief description of the connection */
  description: string;
}

// ─── Scene Graph ────────────────────────────────────────────────────────────

export interface SceneGraph {
  /** Version for forward compatibility */
  version: 1;
  /** Arena name this graph describes */
  arenaName: string;
  /** All spatial nodes in the arena */
  nodes: SceneNode[];
  /** All spatial relationships between nodes */
  edges: SceneEdge[];
  /** Global arena properties */
  globalProperties: {
    /** Overall layout type */
    layoutType: "open" | "enclosed" | "mixed" | "vertical" | "labyrinthine";
    /** Average cover density across all nodes (0-10) */
    avgCoverDensity: number;
    /** Total number of distinct combat zones */
    combatZoneCount: number;
    /** Dominant environmental theme */
    theme: string;
    /** Key strategic insight for the whole arena */
    strategicSummary: string;
  };
  /** Metadata */
  generatedAt: number;
  nodeCount: number;
  edgeCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the best nodes for a given weapon type
 */
export function getBestNodesForWeapon(graph: SceneGraph, weapon: string): SceneNode[] {
  return graph.nodes
    .filter(n => n.tactical.idealWeapons.includes(weapon))
    .sort((a, b) => b.tactical.coverValue - a.tactical.coverValue);
}

/**
 * Get high-value item spawn locations from the graph
 */
export function getItemSpawnNodes(graph: SceneGraph): SceneNode[] {
  return graph.nodes
    .filter(n => n.tactical.itemSpawnAffinity !== "none")
    .sort((a, b) => {
      const priority = { high: 3, medium: 2, low: 1, none: 0 };
      return priority[b.tactical.itemSpawnAffinity] - priority[a.tactical.itemSpawnAffinity];
    });
}

/**
 * Get nodes that overlook a target node (sniper positions)
 */
export function getOverlookingNodes(graph: SceneGraph, targetNodeId: string): SceneNode[] {
  const overlookEdges = graph.edges.filter(e => e.to === targetNodeId && e.relation === "overlooks");
  return overlookEdges
    .map(e => graph.nodes.find(n => n.id === e.from))
    .filter((n): n is SceneNode => n !== undefined);
}

/**
 * Get connected nodes (direct paths from a node)
 */
export function getConnectedNodes(graph: SceneGraph, nodeId: string): SceneNode[] {
  const connected = graph.edges
    .filter(e => (e.from === nodeId || e.to === nodeId) && e.traversable)
    .map(e => e.from === nodeId ? e.to : e.from);
  return connected
    .map(id => graph.nodes.find(n => n.id === id))
    .filter((n): n is SceneNode => n !== undefined);
}

/**
 * Generate a compact agent briefing from the scene graph
 */
export function getSceneGraphBriefing(graph: SceneGraph): string {
  const platforms = graph.nodes.filter(n => n.type === "platform" || n.type === "vantage_point");
  const covers = graph.nodes.filter(n => n.type === "cover_point");
  const chokepoints = graph.nodes.filter(n => n.type === "chokepoint");
  const hazards = graph.nodes.filter(n => n.type === "hazard");
  const spawnNodes = getItemSpawnNodes(graph);

  return `SCENE GRAPH BRIEFING (${graph.arenaName}):
Layout: ${graph.globalProperties.layoutType} | ${graph.nodeCount} zones | ${graph.edgeCount} connections
Platforms/Vantage: ${platforms.length} (${platforms.map(p => p.label).join(", ") || "none"})
Cover Points: ${covers.length} (avg cover: ${(covers.reduce((s, c) => s + c.tactical.coverValue, 0) / Math.max(1, covers.length)).toFixed(1)}/10)
Chokepoints: ${chokepoints.length} (${chokepoints.map(c => c.label).join(", ") || "none"})
Hazards: ${hazards.length} (${hazards.map(h => h.label).join(", ") || "none"})
Item Spawns: ${spawnNodes.length} high-value locations
Strategy: ${graph.globalProperties.strategicSummary}`;
}

/**
 * Generate game master item placement context from scene graph
 */
export function getSceneGraphItemContext(graph: SceneGraph): string {
  const spawnNodes = getItemSpawnNodes(graph);
  const placements = spawnNodes.slice(0, 8).map(n =>
    `• ${n.label} (${n.type}): ${n.description} — spawn affinity: ${n.tactical.itemSpawnAffinity}, features: ${n.tactical.features.join(", ")}`
  ).join("\n");

  return `SCENE GRAPH ITEM PLACEMENT (${graph.arenaName}):
${graph.globalProperties.layoutType} layout, ${graph.globalProperties.avgCoverDensity}/10 avg cover
${spawnNodes.length} spawn-eligible locations:
${placements}`;
}

/**
 * Convert scene graph to post-match learning data for agent memory
 */
export function sceneGraphToLearningData(graph: SceneGraph, agentPerformance: {
  nodeVisited?: string;
  weaponUsed: string;
  outcome: "win" | "loss";
  kills: number;
  deaths: number;
}): string {
  const bestNodes = getBestNodesForWeapon(graph, agentPerformance.weaponUsed);
  const visitedNode = agentPerformance.nodeVisited
    ? graph.nodes.find(n => n.id === agentPerformance.nodeVisited)
    : null;

  return `ARENA LEARNING: ${graph.arenaName} (${graph.globalProperties.layoutType})
Weapon: ${agentPerformance.weaponUsed} | Result: ${agentPerformance.outcome} | K/D: ${agentPerformance.kills}/${agentPerformance.deaths}
Best positions for ${agentPerformance.weaponUsed}: ${bestNodes.slice(0, 3).map(n => n.label).join(", ") || "unknown"}
${visitedNode ? `Fought at: ${visitedNode.label} (cover: ${visitedNode.tactical.coverValue}/10, exposure: ${visitedNode.tactical.exposure}/10)` : ""}
Lesson: ${agentPerformance.outcome === "win"
  ? `${agentPerformance.weaponUsed} effective in ${graph.globalProperties.layoutType} layout`
  : `Consider different weapon/position in ${graph.globalProperties.layoutType} layout`}`;
}

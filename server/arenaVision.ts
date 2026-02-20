/**
 * Arena Vision Analysis — Uses vision LLM to analyze skybox environments
 * 
 * Sends the generated skybox panorama image to GPT-4.1-mini (via invokeLLM)
 * to extract structured scene descriptions:
 * - Spatial layout (corridors, open areas, elevated platforms, chokepoints)
 * - Environmental features (pipes, walls, structures, water, lighting)
 * - Aesthetic mood (dark, neon, industrial, organic, etc.)
 * - Strategic implications (sniper positions, ambush spots, escape routes)
 * 
 * This analysis feeds into:
 * 1. Agent Brain — weapon/strategy adaptation based on arena layout
 * 2. Game Master — contextual item/trap spawning
 * 3. Prediction Market — environment-influenced match predictions
 */

import { invokeLLM } from "./_core/llm";
import type { SceneGraph, SceneNode, SceneEdge, NodeType, EdgeRelation } from "@shared/sceneGraph";
export type { SceneGraph };

export interface SceneAnalysis {
  spatialLayout: {
    type: "open" | "enclosed" | "mixed" | "vertical" | "labyrinthine";
    description: string;
    corridors: number;      // 0-10 density
    openAreas: number;      // 0-10 density
    elevatedPlatforms: number; // 0-10 density
    chokepoints: number;    // 0-10 density
    coverDensity: number;   // 0-10
  };
  environmentalFeatures: string[];  // e.g., ["pipes", "circuit walls", "neon signs", "water channels"]
  aestheticMood: {
    primary: string;        // e.g., "cyberpunk", "industrial", "organic"
    secondary: string;
    lightingLevel: "dark" | "dim" | "moderate" | "bright" | "neon";
    colorPalette: string[]; // dominant colors
    atmosphere: string;     // 1-sentence mood description
  };
  strategicImplications: {
    sniperPositions: number;   // 0-10 favorability
    ambushSpots: number;       // 0-10 favorability
    escapeRoutes: number;      // 0-10 availability
    closeCombatZones: number;  // 0-10 density
    idealWeapons: string[];    // ranked list of best weapons for this arena
    idealStrategy: string;     // 1-sentence strategy recommendation
  };
  itemSpawnSuggestions: Array<{
    item: string;
    location: string;
    reasoning: string;
  }>;
  summary: string;  // 2-3 sentence overall description
}

/**
 * Analyze a skybox image using the vision LLM
 */
export async function analyzeArenaScene(imageUrl: string, arenaName?: string): Promise<SceneAnalysis> {
  const prompt = `You are analyzing a 360° panoramic skybox image of a combat arena called "${arenaName || "Unknown Arena"}".
This is a multiplayer AI agent battle arena where autonomous agents fight with weapons like plasma guns, railguns, scatter blasters, rockets, beam rifles, and void cannons.

Analyze this arena environment and provide a structured assessment covering:

1. SPATIAL LAYOUT — What's the overall structure? Open arena, tight corridors, vertical platforms, labyrinthine passages? Rate density of corridors, open areas, elevated platforms, chokepoints, and cover (0-10 each).

2. ENVIRONMENTAL FEATURES — List specific features you see (pipes, circuit boards, walls, water, neon lights, structures, etc.)

3. AESTHETIC MOOD — What's the visual style? (cyberpunk, industrial, organic, alien, etc.) What's the lighting like? What colors dominate?

4. STRATEGIC IMPLICATIONS — Rate how favorable this arena is for: sniping (0-10), ambushes (0-10), escape routes (0-10), close combat (0-10). What weapons would be best here? What's the ideal strategy?

5. ITEM SPAWN SUGGESTIONS — Based on the environment, suggest 3-5 specific locations where items/traps would make contextual sense (e.g., "overhead pipes → drop trap", "open plaza → sniper perch", "circuit walls → tech crafting materials")

Respond with EXACTLY this JSON structure:
{
  "spatialLayout": {
    "type": "open|enclosed|mixed|vertical|labyrinthine",
    "description": "1-2 sentence description of the layout",
    "corridors": 0-10,
    "openAreas": 0-10,
    "elevatedPlatforms": 0-10,
    "chokepoints": 0-10,
    "coverDensity": 0-10
  },
  "environmentalFeatures": ["feature1", "feature2", ...],
  "aestheticMood": {
    "primary": "style",
    "secondary": "style",
    "lightingLevel": "dark|dim|moderate|bright|neon",
    "colorPalette": ["color1", "color2", "color3"],
    "atmosphere": "1-sentence mood"
  },
  "strategicImplications": {
    "sniperPositions": 0-10,
    "ambushSpots": 0-10,
    "escapeRoutes": 0-10,
    "closeCombatZones": 0-10,
    "idealWeapons": ["weapon1", "weapon2", "weapon3"],
    "idealStrategy": "1-sentence strategy"
  },
  "itemSpawnSuggestions": [
    { "item": "item_name", "location": "where in the arena", "reasoning": "why it fits" }
  ],
  "summary": "2-3 sentence overall description"
}`;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert game environment analyst. You analyze 360° panoramic arena images and provide structured tactical assessments. Respond only with valid JSON."
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            { type: "text", text: prompt },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scene_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              spatialLayout: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["open", "enclosed", "mixed", "vertical", "labyrinthine"] },
                  description: { type: "string" },
                  corridors: { type: "number" },
                  openAreas: { type: "number" },
                  elevatedPlatforms: { type: "number" },
                  chokepoints: { type: "number" },
                  coverDensity: { type: "number" },
                },
                required: ["type", "description", "corridors", "openAreas", "elevatedPlatforms", "chokepoints", "coverDensity"],
                additionalProperties: false,
              },
              environmentalFeatures: { type: "array", items: { type: "string" } },
              aestheticMood: {
                type: "object",
                properties: {
                  primary: { type: "string" },
                  secondary: { type: "string" },
                  lightingLevel: { type: "string", enum: ["dark", "dim", "moderate", "bright", "neon"] },
                  colorPalette: { type: "array", items: { type: "string" } },
                  atmosphere: { type: "string" },
                },
                required: ["primary", "secondary", "lightingLevel", "colorPalette", "atmosphere"],
                additionalProperties: false,
              },
              strategicImplications: {
                type: "object",
                properties: {
                  sniperPositions: { type: "number" },
                  ambushSpots: { type: "number" },
                  escapeRoutes: { type: "number" },
                  closeCombatZones: { type: "number" },
                  idealWeapons: { type: "array", items: { type: "string" } },
                  idealStrategy: { type: "string" },
                },
                required: ["sniperPositions", "ambushSpots", "escapeRoutes", "closeCombatZones", "idealWeapons", "idealStrategy"],
                additionalProperties: false,
              },
              itemSpawnSuggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    item: { type: "string" },
                    location: { type: "string" },
                    reasoning: { type: "string" },
                  },
                  required: ["item", "location", "reasoning"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["spatialLayout", "environmentalFeatures", "aestheticMood", "strategicImplications", "itemSpawnSuggestions", "summary"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content) as SceneAnalysis;
      console.log(`[ArenaVision] Analysis complete for "${arenaName || "Unknown"}": ${parsed.spatialLayout.type} layout, ${parsed.aestheticMood.primary} mood`);
      return parsed;
    }
  } catch (e: any) {
    console.error("[ArenaVision] Vision LLM analysis failed:", e.message);
  }

  // Fallback analysis for when vision LLM is unavailable
  return getDefaultSceneAnalysis(arenaName);
}

/**
 * Get a default scene analysis based on arena name heuristics
 */
function getDefaultSceneAnalysis(arenaName?: string): SceneAnalysis {
  const name = (arenaName || "").toLowerCase();
  const isCyberpunk = name.includes("neon") || name.includes("cyber") || name.includes("circuit");
  const isIndustrial = name.includes("forge") || name.includes("foundry") || name.includes("industrial");
  const isOrganic = name.includes("bio") || name.includes("organic") || name.includes("garden");

  return {
    spatialLayout: {
      type: isCyberpunk ? "mixed" : isIndustrial ? "enclosed" : "open",
      description: isCyberpunk
        ? "A brutalist cyberpunk arena with a mix of open combat zones and tight corridors between massive concrete structures."
        : "A combat arena with varied terrain offering multiple engagement ranges.",
      corridors: isCyberpunk ? 7 : isIndustrial ? 8 : 3,
      openAreas: isCyberpunk ? 5 : isIndustrial ? 3 : 7,
      elevatedPlatforms: isCyberpunk ? 6 : isIndustrial ? 4 : 5,
      chokepoints: isCyberpunk ? 6 : isIndustrial ? 7 : 3,
      coverDensity: isCyberpunk ? 7 : isIndustrial ? 6 : 4,
    },
    environmentalFeatures: isCyberpunk
      ? ["circuit board walls", "neon signage", "pipes and conduits", "concrete pillars", "holographic displays", "rain puddles", "steam vents"]
      : isIndustrial
      ? ["metal grating", "furnaces", "conveyor belts", "molten metal channels", "smoke stacks", "heavy machinery"]
      : ["open terrain", "scattered debris", "structural columns", "energy barriers", "light panels"],
    aestheticMood: {
      primary: isCyberpunk ? "cyberpunk" : isIndustrial ? "industrial" : "futuristic",
      secondary: isCyberpunk ? "brutalist" : isIndustrial ? "steampunk" : "minimalist",
      lightingLevel: isCyberpunk ? "neon" : isIndustrial ? "dim" : "moderate",
      colorPalette: isCyberpunk ? ["#00ff88", "#ff0066", "#0088ff", "#1a1a2e"] : ["#ff6600", "#333333", "#ffcc00"],
      atmosphere: isCyberpunk
        ? "Rain-slicked concrete glows under neon light, creating a moody cyberpunk battleground where shadows hide danger."
        : "A tense combat environment where every corner could hide an enemy.",
    },
    strategicImplications: {
      sniperPositions: isCyberpunk ? 6 : isIndustrial ? 4 : 8,
      ambushSpots: isCyberpunk ? 8 : isIndustrial ? 7 : 4,
      escapeRoutes: isCyberpunk ? 5 : isIndustrial ? 4 : 7,
      closeCombatZones: isCyberpunk ? 7 : isIndustrial ? 8 : 4,
      idealWeapons: isCyberpunk
        ? ["scatter", "plasma", "void"]
        : isIndustrial
        ? ["scatter", "rocket", "plasma"]
        : ["railgun", "beam", "plasma"],
      idealStrategy: isCyberpunk
        ? "Use cover-heavy corridors for ambushes with scatter weapons, then retreat through pipe networks. Snipers should hold elevated platforms."
        : "Adapt weapon choice to engagement range — long-range in open areas, close-range in tight spaces.",
    },
    itemSpawnSuggestions: isCyberpunk
      ? [
          { item: "EMP Trap", location: "Narrow corridor between circuit walls", reasoning: "Tight space forces agents through — perfect ambush point" },
          { item: "Plasma Cell Cache", location: "Elevated platform overlooking main arena", reasoning: "Reward for taking the high ground sniper position" },
          { item: "Stealth Module", location: "Behind steam vent cluster", reasoning: "Steam provides natural concealment, stealth item extends it" },
          { item: "Void Shard", location: "Central neon-lit plaza", reasoning: "High-risk high-reward — exposed position for powerful crafting material" },
          { item: "Shield Generator", location: "Dead-end pipe junction", reasoning: "Defensive item in a vulnerable position creates interesting risk/reward" },
        ]
      : [
          { item: "Health Pack", location: "Central arena area", reasoning: "Contested position rewards aggressive play" },
          { item: "Damage Boost", location: "Elevated platform", reasoning: "Sniper advantage combined with damage increase" },
          { item: "Speed Boost", location: "Open ground between cover", reasoning: "Helps agents cross dangerous open areas" },
        ],
    summary: isCyberpunk
      ? "A brutalist cyberpunk arena drenched in neon and rain. Massive concrete structures with circuit-board textures create a maze of corridors and open plazas. The environment heavily favors ambush tactics and close-to-mid range combat, with elevated platforms offering sniper opportunities for agents willing to expose themselves."
      : "A combat arena with varied terrain offering multiple engagement options. The environment supports diverse strategies depending on weapon choice and positioning.",
  };
}

/**
 * Generate a compact scene briefing for the agent brain
 * (Shorter version optimized for LLM context window)
 */
export function getAgentSceneBriefing(analysis: SceneAnalysis): string {
  return `ARENA ENVIRONMENT:
Layout: ${analysis.spatialLayout.type} — ${analysis.spatialLayout.description}
Key Features: ${analysis.environmentalFeatures.slice(0, 5).join(", ")}
Mood: ${analysis.aestheticMood.primary} / ${analysis.aestheticMood.lightingLevel} lighting
Best Weapons: ${analysis.strategicImplications.idealWeapons.join(", ")}
Strategy: ${analysis.strategicImplications.idealStrategy}
Sniper Favorability: ${analysis.strategicImplications.sniperPositions}/10 | Ambush: ${analysis.strategicImplications.ambushSpots}/10 | Close Combat: ${analysis.strategicImplications.closeCombatZones}/10`;
}

/**
 * Generate game master spawn context from scene analysis
 */
export function getGameMasterSpawnContext(analysis: SceneAnalysis): string {
  const spawns = analysis.itemSpawnSuggestions
    .map(s => `• ${s.item} at ${s.location} — ${s.reasoning}`)
    .join("\n");

  return `ARENA CONTEXT FOR ITEM SPAWNING:
Layout Type: ${analysis.spatialLayout.type}
Cover Density: ${analysis.spatialLayout.coverDensity}/10
Chokepoints: ${analysis.spatialLayout.chokepoints}/10
Features: ${analysis.environmentalFeatures.join(", ")}
Mood: ${analysis.aestheticMood.atmosphere}

SUGGESTED SPAWNS:
${spawns}`;
}

/**
 * Generate prediction market context from scene analysis
 */
// ─── SCENE GRAPH GENERATION ─────────────────────────────────────────────────

/**
 * Generate a structured scene graph from a skybox image using vision LLM.
 * Returns nodes (spatial elements with tactical properties) and edges
 * (spatial relationships) for agent pathfinding and game master item placement.
 */
export async function generateSceneGraph(imageUrl: string, arenaName?: string): Promise<SceneGraph> {
  const prompt = `You are analyzing a 360° panoramic skybox image of a combat arena called "${arenaName || "Unknown Arena"}".
This is a multiplayer AI agent battle arena. Your task is to produce a STRUCTURED SCENE GRAPH — a JSON representation of the arena's spatial layout as nodes and edges.

NODES represent distinct spatial elements:
- platform: Elevated surface, sniper advantage
- corridor: Narrow passage, ambush risk
- open_area: Wide space, exposed but mobile
- cover_point: Defensive position with partial protection
- chokepoint: Narrow bottleneck between areas
- spawn_zone: Good location for agent/item spawns
- hazard: Environmental danger
- vantage_point: High ground with wide sightlines
- junction: Intersection of multiple paths
- dead_end: Single-entry area

Each node needs:
- id: unique string like "platform-north-1"
- label: human-readable name like "North Elevated Platform"
- type: one of the node types above
- tactical: { coverValue(0-10), exposure(0-10), elevation(0-10), sightlines(0-10), escapability(0-10), idealWeapons(string[]), features(string[]), itemSpawnAffinity("none"|"low"|"medium"|"high") }
- position: { x(-1 to 1), z(-1 to 1), y(0 to 1) } approximate normalized position
- size: "small" | "medium" | "large"
- description: brief visual description

EDGES represent spatial relationships between nodes:
- from/to: node IDs
- relation: "connected_to" | "overlooks" | "adjacent_to" | "above" | "below" | "leads_to" | "blocks_view_of"
- traversalCost(0-10), traversable(bool), hasLineOfSight(bool), description

Generate 8-15 nodes and 12-25 edges that capture the arena's tactical structure.
Also provide globalProperties: { layoutType, avgCoverDensity(0-10), combatZoneCount, theme, strategicSummary }

Respond with EXACTLY this JSON structure:
{
  "version": 1,
  "arenaName": "string",
  "nodes": [...],
  "edges": [...],
  "globalProperties": { "layoutType": "open|enclosed|mixed|vertical|labyrinthine", "avgCoverDensity": 0-10, "combatZoneCount": number, "theme": "string", "strategicSummary": "string" },
  "generatedAt": ${Date.now()},
  "nodeCount": number,
  "edgeCount": number
}`;

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are an expert game level designer who analyzes 360° panoramic arena images and produces structured scene graphs as JSON. Respond only with valid JSON."
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(jsonStr) as SceneGraph;
      // Ensure counts match
      parsed.nodeCount = parsed.nodes.length;
      parsed.edgeCount = parsed.edges.length;
      parsed.generatedAt = Date.now();
      console.log(`[ArenaVision] Scene graph generated for "${arenaName}": ${parsed.nodeCount} nodes, ${parsed.edgeCount} edges`);
      return parsed;
    }
  } catch (e: any) {
    console.error("[ArenaVision] Scene graph generation failed:", e.message);
  }

  // Fallback: generate a default scene graph
  return getDefaultSceneGraph(arenaName);
}

/**
 * Generate a default scene graph when vision LLM is unavailable
 */
function getDefaultSceneGraph(arenaName?: string): SceneGraph {
  const name = (arenaName || "").toLowerCase();
  const isCyberpunk = name.includes("neon") || name.includes("cyber") || name.includes("circuit");

  const nodes: SceneNode[] = [
    {
      id: "center-arena", label: "Central Arena", type: "open_area",
      tactical: { coverValue: 2, exposure: 9, elevation: 0, sightlines: 8, escapability: 7, idealWeapons: ["railgun", "beam"], features: ["open ground", "grid floor"], itemSpawnAffinity: "high" },
      position: { x: 0, z: 0, y: 0 }, size: "large",
      description: "The main open combat zone at the center of the arena"
    },
    {
      id: "north-platform", label: "North Elevated Platform", type: "platform",
      tactical: { coverValue: 5, exposure: 6, elevation: 7, sightlines: 9, escapability: 4, idealWeapons: ["railgun", "beam", "missile"], features: isCyberpunk ? ["neon railing", "circuit panels"] : ["metal railing"], itemSpawnAffinity: "medium" },
      position: { x: 0, z: -0.7, y: 0.6 }, size: "medium",
      description: "An elevated platform on the north side with excellent sightlines"
    },
    {
      id: "south-corridor", label: "South Corridor", type: "corridor",
      tactical: { coverValue: 7, exposure: 3, elevation: 0, sightlines: 3, escapability: 4, idealWeapons: ["scatter", "plasma"], features: isCyberpunk ? ["pipes", "steam vents"] : ["walls"], itemSpawnAffinity: "medium" },
      position: { x: 0, z: 0.7, y: 0 }, size: "medium",
      description: "A narrow corridor on the south side, good for ambushes"
    },
    {
      id: "east-cover", label: "East Cover Cluster", type: "cover_point",
      tactical: { coverValue: 8, exposure: 3, elevation: 1, sightlines: 4, escapability: 6, idealWeapons: ["plasma", "scatter"], features: isCyberpunk ? ["concrete pillars", "holographic displays"] : ["pillars"], itemSpawnAffinity: "low" },
      position: { x: 0.6, z: 0, y: 0.1 }, size: "medium",
      description: "A cluster of cover objects on the east side"
    },
    {
      id: "west-chokepoint", label: "West Chokepoint", type: "chokepoint",
      tactical: { coverValue: 4, exposure: 5, elevation: 0, sightlines: 2, escapability: 3, idealWeapons: ["nova", "scatter", "plasma"], features: isCyberpunk ? ["narrow gap", "neon archway"] : ["narrow gap"], itemSpawnAffinity: "high" },
      position: { x: -0.6, z: 0, y: 0 }, size: "small",
      description: "A narrow chokepoint on the west side — dangerous to cross"
    },
    {
      id: "ne-vantage", label: "Northeast Vantage", type: "vantage_point",
      tactical: { coverValue: 3, exposure: 7, elevation: 8, sightlines: 10, escapability: 3, idealWeapons: ["railgun", "beam"], features: ["high ground", "exposed"], itemSpawnAffinity: "low" },
      position: { x: 0.5, z: -0.5, y: 0.7 }, size: "small",
      description: "The highest point in the northeast — excellent for sniping but very exposed"
    },
    {
      id: "sw-dead-end", label: "Southwest Dead End", type: "dead_end",
      tactical: { coverValue: 9, exposure: 1, elevation: 0, sightlines: 1, escapability: 1, idealWeapons: ["scatter", "nova"], features: isCyberpunk ? ["pipe junction", "steam"] : ["wall"], itemSpawnAffinity: "high" },
      position: { x: -0.5, z: 0.5, y: 0 }, size: "small",
      description: "A dead-end alcove — defensible but easy to trap"
    },
    {
      id: "nw-junction", label: "Northwest Junction", type: "junction",
      tactical: { coverValue: 4, exposure: 6, elevation: 2, sightlines: 5, escapability: 8, idealWeapons: ["plasma", "beam"], features: ["intersection", "multiple exits"], itemSpawnAffinity: "medium" },
      position: { x: -0.5, z: -0.5, y: 0.2 }, size: "medium",
      description: "A junction where three paths meet — high traffic area"
    },
    {
      id: "se-spawn", label: "Southeast Spawn Zone", type: "spawn_zone",
      tactical: { coverValue: 5, exposure: 5, elevation: 0, sightlines: 4, escapability: 7, idealWeapons: ["plasma"], features: ["spawn pad", "energy field"], itemSpawnAffinity: "high" },
      position: { x: 0.5, z: 0.5, y: 0 }, size: "medium",
      description: "A spawn zone in the southeast with moderate protection"
    },
  ];

  const edges: SceneEdge[] = [
    { from: "center-arena", to: "north-platform", relation: "connected_to", traversalCost: 3, traversable: true, hasLineOfSight: true, description: "Ramp from center to north platform" },
    { from: "center-arena", to: "south-corridor", relation: "connected_to", traversalCost: 2, traversable: true, hasLineOfSight: true, description: "Open path to south corridor entrance" },
    { from: "center-arena", to: "east-cover", relation: "connected_to", traversalCost: 2, traversable: true, hasLineOfSight: true, description: "Direct path to east cover cluster" },
    { from: "center-arena", to: "west-chokepoint", relation: "connected_to", traversalCost: 2, traversable: true, hasLineOfSight: true, description: "Path to west chokepoint" },
    { from: "north-platform", to: "center-arena", relation: "overlooks", traversalCost: 0, traversable: false, hasLineOfSight: true, description: "Platform overlooks the central arena" },
    { from: "north-platform", to: "ne-vantage", relation: "connected_to", traversalCost: 4, traversable: true, hasLineOfSight: true, description: "Ledge path to northeast vantage" },
    { from: "ne-vantage", to: "center-arena", relation: "overlooks", traversalCost: 0, traversable: false, hasLineOfSight: true, description: "Vantage overlooks entire center" },
    { from: "ne-vantage", to: "east-cover", relation: "overlooks", traversalCost: 0, traversable: false, hasLineOfSight: true, description: "Vantage overlooks east cover" },
    { from: "south-corridor", to: "sw-dead-end", relation: "leads_to", traversalCost: 2, traversable: true, hasLineOfSight: false, description: "Corridor leads to dead-end alcove" },
    { from: "south-corridor", to: "se-spawn", relation: "connected_to", traversalCost: 3, traversable: true, hasLineOfSight: true, description: "Path from corridor to spawn zone" },
    { from: "west-chokepoint", to: "nw-junction", relation: "connected_to", traversalCost: 3, traversable: true, hasLineOfSight: false, description: "Narrow path through chokepoint to junction" },
    { from: "west-chokepoint", to: "sw-dead-end", relation: "adjacent_to", traversalCost: 4, traversable: true, hasLineOfSight: false, description: "Side path to dead end" },
    { from: "nw-junction", to: "north-platform", relation: "connected_to", traversalCost: 3, traversable: true, hasLineOfSight: true, description: "Path from junction up to platform" },
    { from: "nw-junction", to: "center-arena", relation: "connected_to", traversalCost: 2, traversable: true, hasLineOfSight: true, description: "Direct path from junction to center" },
    { from: "east-cover", to: "se-spawn", relation: "connected_to", traversalCost: 2, traversable: true, hasLineOfSight: true, description: "Path from cover to spawn zone" },
    { from: "north-platform", to: "south-corridor", relation: "blocks_view_of", traversalCost: 0, traversable: false, hasLineOfSight: false, description: "Platform structure blocks view of south corridor" },
  ];

  return {
    version: 1,
    arenaName: arenaName || "Unknown Arena",
    nodes,
    edges,
    globalProperties: {
      layoutType: isCyberpunk ? "mixed" : "open",
      avgCoverDensity: Math.round(nodes.reduce((s, n) => s + n.tactical.coverValue, 0) / nodes.length),
      combatZoneCount: nodes.filter(n => ["open_area", "corridor", "chokepoint"].includes(n.type)).length,
      theme: isCyberpunk ? "cyberpunk brutalist" : "futuristic",
      strategicSummary: isCyberpunk
        ? "Mixed layout favors versatile loadouts. Use corridors for ambushes, platforms for sniping, and the central arena for decisive engagements."
        : "Open layout with elevated positions. Long-range weapons dominate the center, close-range weapons excel in corridors and chokepoints.",
    },
    generatedAt: Date.now(),
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

export function getPredictionContext(analysis: SceneAnalysis): string {
  const layout = analysis.spatialLayout;
  const strat = analysis.strategicImplications;

  let advantage = "balanced";
  if (strat.sniperPositions >= 7) advantage = "long-range specialists";
  else if (strat.closeCombatZones >= 7) advantage = "close-combat brawlers";
  else if (strat.ambushSpots >= 7) advantage = "ambush/stealth agents";

  return `Arena favors ${advantage}. Layout: ${layout.type} (cover: ${layout.coverDensity}/10, chokepoints: ${layout.chokepoints}/10). Best weapons: ${strat.idealWeapons.slice(0, 3).join(", ")}. ${strat.idealStrategy}`;
}

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
export function getPredictionContext(analysis: SceneAnalysis): string {
  const layout = analysis.spatialLayout;
  const strat = analysis.strategicImplications;

  let advantage = "balanced";
  if (strat.sniperPositions >= 7) advantage = "long-range specialists";
  else if (strat.closeCombatZones >= 7) advantage = "close-combat brawlers";
  else if (strat.ambushSpots >= 7) advantage = "ambush/stealth agents";

  return `Arena favors ${advantage}. Layout: ${layout.type} (cover: ${layout.coverDensity}/10, chokepoints: ${layout.chokepoints}/10). Best weapons: ${strat.idealWeapons.slice(0, 3).join(", ")}. ${strat.idealStrategy}`;
}

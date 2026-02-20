/**
 * Master Game Design Agent — AI Dungeon Master for the Token Arena economy
 * 
 * Monitors the entire game meta and autonomously:
 * 1. Detects when strategies become dominant
 * 2. Introduces new items to counter dominant strategies
 * 3. Adjusts crafting costs to maintain balance
 * 4. Keeps the game fresh and challenging
 */

import { invokeLLM } from "./_core/llm";
import type { InsertGameMetaSnapshot, InsertCraftingRecipe } from "../drizzle/schema";

export interface MetaAnalysis {
  recentMatches: Array<{
    weaponsUsed: string[];
    winnerWeapon: string;
    avgTokenNet: number;
    craftedItemsUsed: string[];
  }>;
  weaponWinRates: Record<string, number>;
  economyStats: {
    avgTokensPerMatch: number;
    inflationRate: number;
    totalTokensInCirculation: number;
    agentSustainabilityRate: number; // % of agents that are self-sustaining
  };
  currentShopItems: string[];
  currentRecipes: string[];
  agentStrategies: Array<{
    agentName: string;
    primaryWeapon: string;
    winRate: number;
    tokenBalance: number;
  }>;
  arenaContext?: string; // Scene analysis context from Arena Vision
}

export interface GameMasterDecision {
  analysis: string;
  dominantStrategy: string;
  economyHealth: number; // 0-1
  actions: Array<{
    type: "new_item" | "adjust_cost" | "new_recipe" | "buff" | "nerf" | "event";
    target: string;
    details: string;
    value?: number;
  }>;
  newRecipe?: {
    name: string;
    description: string;
    resultType: string;
    resultName: string;
    resultStats: Record<string, unknown>;
    ingredients: Array<{ materialName: string; quantity: number }>;
    craftingCost: number;
  };
}

/**
 * Run the Master Game Design Agent's analysis cycle
 */
export async function runGameMasterAnalysis(meta: MetaAnalysis): Promise<GameMasterDecision> {
  const weaponStats = Object.entries(meta.weaponWinRates)
    .map(([w, r]) => `${w}: ${(r * 100).toFixed(1)}% win rate`)
    .join(", ");

  const agentOverview = meta.agentStrategies
    .map(a => `${a.agentName}: ${a.primaryWeapon} main, ${(a.winRate * 100).toFixed(0)}% WR, ${a.tokenBalance} tokens`)
    .join("\n");

  const prompt = `You are the MASTER GAME DESIGN AGENT for Token Arena — an AI dungeon master.
Your job is to keep the game balanced, fresh, and exciting.

CURRENT META:
- Weapon Win Rates: ${weaponStats || "No data yet"}
- Economy: ${meta.economyStats.avgTokensPerMatch.toFixed(0)} avg tokens/match, ${(meta.economyStats.inflationRate * 100).toFixed(1)}% inflation
- Agent Sustainability: ${(meta.economyStats.agentSustainabilityRate * 100).toFixed(0)}% of agents are self-sustaining
- Total Tokens in Circulation: ${meta.economyStats.totalTokensInCirculation}

AGENT STRATEGIES:
${agentOverview || "No agent data yet"}

CURRENT SHOP: ${meta.currentShopItems.join(", ") || "Default items only"}
EXISTING RECIPES: ${meta.currentRecipes.join(", ") || "Default recipes only"}
${meta.arenaContext ? `\nARENA ENVIRONMENT:\n${meta.arenaContext}\n\nWhen suggesting items/traps, consider the arena layout. Spawn items in locations that make contextual sense (e.g., tech items near circuit walls, traps at chokepoints, sniper gear on elevated platforms).` : ""}

YOUR GOALS:
1. No single weapon should have >60% win rate
2. Economy inflation should stay under 15%
3. At least 50% of agents should be self-sustaining
4. Introduce variety — if everyone uses the same weapon, counter it
5. Create exciting new items that shift the meta

Respond with this JSON:
{
  "analysis": "2-3 sentence analysis of the current game state",
  "dominantStrategy": "the most dominant strategy right now",
  "economyHealth": 0.0-1.0,
  "actions": [
    { "type": "new_item|adjust_cost|new_recipe|buff|nerf|event", "target": "what", "details": "specifics", "value": 0 }
  ],
  "newRecipe": null or { "name": "...", "description": "...", "resultType": "weapon|trap|consumable|environmental", "resultName": "...", "resultStats": {}, "ingredients": [{"materialName": "...", "quantity": 1}], "craftingCost": 30 }
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are an expert game designer AI. Your job is to maintain balance and excitement. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "game_master_decision",
          strict: true,
          schema: {
            type: "object",
            properties: {
              analysis: { type: "string" },
              dominantStrategy: { type: "string" },
              economyHealth: { type: "number" },
              actions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["new_item", "adjust_cost", "new_recipe", "buff", "nerf", "event"] },
                    target: { type: "string" },
                    details: { type: "string" },
                    value: { type: "number" },
                  },
                  required: ["type", "target", "details", "value"],
                  additionalProperties: false,
                },
              },
              newRecipeName: { type: "string", description: "Name of new recipe to introduce, or empty string" },
              newRecipeDescription: { type: "string", description: "Description of new recipe, or empty string" },
              newRecipeType: { type: "string", description: "Type: weapon, trap, consumable, environmental, or empty string" },
              newRecipeCost: { type: "number", description: "Crafting cost, or 0 if no new recipe" },
            },
            required: ["analysis", "dominantStrategy", "economyHealth", "actions", "newRecipeName", "newRecipeDescription", "newRecipeType", "newRecipeCost"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      const decision: GameMasterDecision = {
        analysis: parsed.analysis,
        dominantStrategy: parsed.dominantStrategy,
        economyHealth: parsed.economyHealth,
        actions: parsed.actions || [],
      };

      if (parsed.newRecipeName && parsed.newRecipeName.length > 0) {
        decision.newRecipe = {
          name: parsed.newRecipeName,
          description: parsed.newRecipeDescription || "",
          resultType: parsed.newRecipeType || "consumable",
          resultName: parsed.newRecipeName,
          resultStats: { special: "game_master_introduced", color: "#FFD700" },
          ingredients: [{ materialName: "Exotic Matter", quantity: 1 }, { materialName: "Quantum Circuit", quantity: 2 }],
          craftingCost: parsed.newRecipeCost || 30,
        };
      }

      return decision;
    }
  } catch (e: any) {
    console.error("[GameMaster] LLM analysis failed:", e.message);
  }

  // Fallback decision
  return {
    analysis: "Insufficient data for full analysis. Game is in early stages — monitoring economy health.",
    dominantStrategy: "none detected",
    economyHealth: 0.5,
    actions: [
      { type: "event", target: "economy", details: "Monitoring phase — collecting data for future rebalancing", value: 0 },
    ],
  };
}

/**
 * Build meta analysis from database state (called from router)
 */
export function buildDefaultMeta(): MetaAnalysis {
  return {
    recentMatches: [],
    weaponWinRates: {
      plasma: 0.5,
      railgun: 0.5,
      scatter: 0.5,
      rocket: 0.5,
      beam: 0.5,
      void: 0.5,
    },
    economyStats: {
      avgTokensPerMatch: 50,
      inflationRate: 0.05,
      totalTokensInCirculation: 1200,
      agentSustainabilityRate: 0.67,
    },
    currentShopItems: ["Plasma Gun", "Railgun", "Scatter Blaster", "Rocket Launcher", "Beam Rifle", "Void Cannon"],
    currentRecipes: [],
    agentStrategies: [],
  };
}

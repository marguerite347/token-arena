/**
 * Crafting Engine — Emergent item generation system
 * 
 * Agents collect materials during battle, combine them into new weapons/items,
 * and those items become new token types in the game economy.
 * Every match is unique because agents bring crafted items others haven't seen.
 */

import { invokeLLM } from "./_core/llm";
import type { InsertCraftingMaterial, InsertCraftingRecipe, InsertCraftedItem } from "../drizzle/schema";

// ─── Default Materials ──────────────────────────────────────────────────────
export const DEFAULT_MATERIALS: InsertCraftingMaterial[] = [
  { name: "Energy Core", description: "Pulsing energy cell salvaged from plasma weapons", rarity: "common", category: "energy_core", color: "#00F0FF", dropRate: 0.25 },
  { name: "Metal Shard", description: "Hardened alloy fragment from destroyed armor", rarity: "common", category: "metal_shard", color: "#8899AA", dropRate: 0.30 },
  { name: "Neon Crystal", description: "Crystallized light energy with unique refractive properties", rarity: "uncommon", category: "crystal", color: "#FF00AA", dropRate: 0.15 },
  { name: "Quantum Circuit", description: "Miniaturized quantum processor from advanced weaponry", rarity: "uncommon", category: "circuit", color: "#39FF14", dropRate: 0.12 },
  { name: "Exotic Matter", description: "Unstable matter with reality-bending properties", rarity: "rare", category: "exotic_matter", color: "#FFB800", dropRate: 0.06 },
  { name: "Void Essence", description: "Condensed void energy — extremely dangerous and valuable", rarity: "epic", category: "void_essence", color: "#9D00FF", dropRate: 0.03 },
  { name: "Skybox Fragment", description: "A shard of the arena's reality fabric — can reshape environments", rarity: "legendary", category: "skybox_fragment", color: "#FF4400", dropRate: 0.01 },
];

// ─── Default Recipes ────────────────────────────────────────────────────────
export const DEFAULT_RECIPES: InsertCraftingRecipe[] = [
  {
    name: "Plasma Repeater",
    description: "Rapid-fire plasma weapon with lower damage but extreme fire rate",
    resultType: "weapon",
    resultName: "Plasma Repeater",
    resultStats: { damage: 8, fireRate: 12, range: 40, color: "#00CCFF", special: "rapid_fire" },
    ingredients: [{ materialName: "Energy Core", quantity: 3 }, { materialName: "Quantum Circuit", quantity: 1 }],
    craftingCost: 25,
    isEmergent: 0,
  },
  {
    name: "Scatter Mine",
    description: "Deployable trap that explodes with scatter pellets when triggered",
    resultType: "trap",
    resultName: "Scatter Mine",
    resultStats: { damage: 40, radius: 8, triggerRange: 5, color: "#FFB800", special: "proximity_trigger" },
    ingredients: [{ materialName: "Metal Shard", quantity: 4 }, { materialName: "Exotic Matter", quantity: 1 }],
    craftingCost: 35,
    isEmergent: 0,
  },
  {
    name: "Void Shield",
    description: "Temporary shield that absorbs incoming projectiles and converts them to tokens",
    resultType: "consumable",
    resultName: "Void Shield",
    resultStats: { duration: 5, absorption: 50, tokenConversion: 0.5, color: "#9D00FF", special: "absorb_to_tokens" },
    ingredients: [{ materialName: "Void Essence", quantity: 1 }, { materialName: "Neon Crystal", quantity: 2 }],
    craftingCost: 40,
    isEmergent: 0,
  },
  {
    name: "Neon Barrier",
    description: "Deployable energy wall that blocks projectiles for a short time",
    resultType: "environmental",
    resultName: "Neon Barrier",
    resultStats: { health: 100, duration: 10, width: 6, color: "#FF00AA", special: "projectile_block" },
    ingredients: [{ materialName: "Neon Crystal", quantity: 3 }, { materialName: "Energy Core", quantity: 2 }],
    craftingCost: 30,
    isEmergent: 0,
  },
  {
    name: "Quantum Railgun",
    description: "Enhanced railgun that phases through walls for 50% damage",
    resultType: "weapon",
    resultName: "Quantum Railgun",
    resultStats: { damage: 35, fireRate: 0.6, range: 100, color: "#39FF14", special: "phase_through" },
    ingredients: [{ materialName: "Quantum Circuit", quantity: 3 }, { materialName: "Exotic Matter", quantity: 1 }, { materialName: "Metal Shard", quantity: 2 }],
    craftingCost: 50,
    isEmergent: 0,
  },
  {
    name: "Reality Anchor",
    description: "Environmental object that slows all enemies in range and drains their tokens",
    resultType: "environmental",
    resultName: "Reality Anchor",
    resultStats: { radius: 10, slowFactor: 0.5, tokenDrain: 2, duration: 15, color: "#FF4400", special: "area_slow_drain" },
    ingredients: [{ materialName: "Skybox Fragment", quantity: 1 }, { materialName: "Void Essence", quantity: 1 }, { materialName: "Exotic Matter", quantity: 2 }],
    craftingCost: 75,
    isEmergent: 0,
  },
];

/**
 * Generate a completely new emergent recipe using LLM
 * This is how agents create items that have never existed before
 */
export async function generateEmergentRecipe(
  agentName: string,
  agentId: number,
  availableMaterials: string[],
  existingRecipes: string[],
  metaContext: string,
): Promise<InsertCraftingRecipe | null> {
  const prompt = `You are the crafting AI for ${agentName} in Token Arena, a combat arena game.
The agent wants to craft something NEW that doesn't exist yet.

AVAILABLE MATERIALS: ${availableMaterials.join(", ")}
EXISTING RECIPES (avoid duplicating): ${existingRecipes.join(", ")}
CURRENT META: ${metaContext}

Create a completely NEW item recipe. It should be:
- Creative and surprising (not just a variant of existing items)
- Balanced (not overpowered)
- One of: weapon, armor, consumable, trap, environmental, ammo
- Named with a cool cyberpunk/sci-fi name

Respond with this JSON:
{
  "name": "Recipe Name",
  "description": "What this item does (1-2 sentences)",
  "resultType": "weapon|armor|consumable|trap|environmental|ammo",
  "resultName": "Item Name",
  "resultStats": { "damage": 0, "fireRate": 0, "range": 0, "color": "#HEX", "special": "unique_ability_name", "duration": 0 },
  "ingredients": [{ "materialName": "Material Name", "quantity": 1 }],
  "craftingCost": 30
}`;

  try {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are a creative game designer AI. Create unique, balanced items. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "emergent_recipe",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              resultType: { type: "string", enum: ["weapon", "armor", "consumable", "trap", "environmental", "ammo"] },
              resultName: { type: "string" },
              resultStats: {
                type: "object",
                properties: {
                  damage: { type: "number" },
                  fireRate: { type: "number" },
                  range: { type: "number" },
                  color: { type: "string" },
                  special: { type: "string" },
                  duration: { type: "number" },
                },
                required: ["damage", "fireRate", "range", "color", "special", "duration"],
                additionalProperties: false,
              },
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    materialName: { type: "string" },
                    quantity: { type: "number" },
                  },
                  required: ["materialName", "quantity"],
                  additionalProperties: false,
                },
              },
              craftingCost: { type: "number" },
            },
            required: ["name", "description", "resultType", "resultName", "resultStats", "ingredients", "craftingCost"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      return {
        name: parsed.name,
        description: parsed.description,
        resultType: parsed.resultType,
        resultName: parsed.resultName,
        resultStats: parsed.resultStats,
        ingredients: parsed.ingredients,
        craftingCost: parsed.craftingCost,
        discoveredBy: agentId,
        isEmergent: 1,
      };
    }
  } catch (e: any) {
    console.error(`[CraftingEngine] Emergent recipe generation failed:`, e.message);
  }

  return null;
}

/**
 * Determine what materials drop from a kill based on weapon used and rarity
 */
export function rollMaterialDrops(weaponUsed: string, killStreak: number): Array<{ materialName: string; quantity: number }> {
  const drops: Array<{ materialName: string; quantity: number }> = [];
  const streakBonus = Math.min(killStreak * 0.02, 0.2); // up to 20% bonus

  for (const mat of DEFAULT_MATERIALS) {
    const adjustedRate = (mat.dropRate ?? 0.1) + streakBonus;
    if (Math.random() < adjustedRate) {
      // Weapon affinity: certain weapons drop certain materials more often
      let quantity = 1;
      if (weaponUsed === "plasma" && mat.category === "energy_core") quantity = 2;
      if (weaponUsed === "railgun" && mat.category === "metal_shard") quantity = 2;
      if (weaponUsed === "void" && mat.category === "void_essence") quantity = 2;
      if (weaponUsed === "beam" && mat.category === "crystal") quantity = 2;
      if (weaponUsed === "rocket" && mat.category === "exotic_matter") quantity = 2;
      if (weaponUsed === "scatter" && mat.category === "circuit") quantity = 2;

      drops.push({ materialName: mat.name, quantity });
    }
  }

  return drops;
}

/**
 * Check if an agent can craft a recipe given their inventory
 */
export function canCraftRecipe(
  recipe: { ingredients: unknown; craftingCost: number },
  inventory: Array<{ name: string; quantity: number }>,
  tokenBalance: number,
): boolean {
  if (tokenBalance < recipe.craftingCost) return false;

  const ingredients = recipe.ingredients as Array<{ materialName: string; quantity: number }>;
  for (const ing of ingredients) {
    const held = inventory.find(i => i.name === ing.materialName);
    if (!held || held.quantity < ing.quantity) return false;
  }

  return true;
}

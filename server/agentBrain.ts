/**
 * Agent Brain — LLM-powered autonomous decision-making engine
 *
 * Each AI agent uses this to:
 * 1. Analyze their match performance history
 * 2. Reason about resource allocation (what to buy/craft/trade)
 * 3. Adapt loadout strategy based on win/loss patterns
 * 4. Learn from past decisions and their outcomes
 * 5. Maintain self-sustaining economics (earn > spend)
 *
 * v22: Each agent is powered by a DIFFERENT LLM via OpenRouter
 *      (Claude, GPT-4o, Llama, Mistral, Gemini, DeepSeek)
 *      with genuinely distinct reasoning styles.
 *
 * v23: Persistent cross-match memories are retrieved and injected
 *      into the reasoning prompt so agents learn over time.
 */

import { invokeLLM } from "./_core/llm";
import { invokeAgentLLM, getAgentModel, getAgentModelKey, type LLMModelConfig } from "./openRouterLLM";
import {
  getAgentById, getAgentMemories, saveAgentMemory, saveAgentDecision,
  getAgentDecisionHistory, getAgentInventoryItems, getAvailableRecipes,
} from "./db";
import { recordComputeSpending, calculateMemoryCost, calculateMemoryQueryCost } from "./agentLifecycle";

export interface AgentPerformance {
  agentId: number;
  agentName: string;
  recentMatches: Array<{
    won: boolean;
    kills: number;
    deaths: number;
    tokensEarned: number;
    tokensSpent: number;
    weaponUsed: string;
  }>;
  totalTokenBalance: number;
  currentLoadout: { primary: string; secondary: string; armor: number };
  inventory: Array<{ name: string; type: string; quantity: number }>;
  memories: Array<{ type: string; content: string; confidence: number; successRate: number }>;
  arenaContext?: string; // Scene analysis briefing from Arena Vision
  llmModel?: string; // Which LLM powers this agent
  llmModelConfig?: LLMModelConfig;
}

export interface AgentDecisionResult {
  action: "buy_weapon" | "change_loadout" | "craft" | "trade" | "save_tokens" | "buy_consumable" | "buy_armor";
  target: string;
  reasoning: string;
  cost: number;
  confidence: number;
  newMemory?: string;
  llmModel?: string; // Which LLM made this decision
}

/**
 * Have an agent reason about what to do after a match.
 * Uses the agent's assigned LLM via OpenRouter for genuinely diverse reasoning.
 */
export async function agentReason(perf: AgentPerformance): Promise<AgentDecisionResult> {
  const winRate = perf.recentMatches.length > 0
    ? perf.recentMatches.filter(m => m.won).length / perf.recentMatches.length
    : 0;
  const avgKD = perf.recentMatches.length > 0
    ? perf.recentMatches.reduce((s, m) => s + (m.deaths > 0 ? m.kills / m.deaths : m.kills), 0) / perf.recentMatches.length
    : 1;
  const avgTokenNet = perf.recentMatches.length > 0
    ? perf.recentMatches.reduce((s, m) => s + (m.tokensEarned - m.tokensSpent), 0) / perf.recentMatches.length
    : 0;

  // ─── Persistent Memory Briefing ──────────────────────────────
  // Inject cross-match memories so agents learn over time
  let memoryBriefing = "";
  if (perf.memories.length > 0) {
    const strategyMems = perf.memories.filter(m => m.type === "strategy" && m.confidence > 0.5);
    const failureMems = perf.memories.filter(m => m.type === "failure" && m.confidence > 0.3);
    const economyMems = perf.memories.filter(m => m.type === "economy");

    if (strategyMems.length > 0) {
      memoryBriefing += "\nSTRATEGIES THAT WORKED:\n" +
        strategyMems.slice(0, 5).map(m => `  • ${m.content} (confidence: ${m.confidence.toFixed(2)})`).join("\n");
    }
    if (failureMems.length > 0) {
      memoryBriefing += "\nSTRATEGIES THAT FAILED:\n" +
        failureMems.slice(0, 3).map(m => `  • ${m.content} (confidence: ${m.confidence.toFixed(2)})`).join("\n");
    }
    if (economyMems.length > 0) {
      memoryBriefing += "\nECONOMIC LESSONS:\n" +
        economyMems.slice(0, 3).map(m => `  • ${m.content}`).join("\n");
    }
  } else {
    memoryBriefing = "\nNo memories yet — this is a fresh agent. Learn from this match.";
  }

  const inventorySummary = perf.inventory.length > 0
    ? perf.inventory.map(i => `${i.name} (${i.type}) x${i.quantity}`).join(", ")
    : "Empty inventory";

  const recentMatchSummary = perf.recentMatches.slice(0, 5).map((m, i) =>
    `Match ${i + 1}: ${m.won ? "WIN" : "LOSS"} | K:${m.kills} D:${m.deaths} | Earned:${m.tokensEarned} Spent:${m.tokensSpent} | Weapon:${m.weaponUsed}`
  ).join("\n");

  const arenaSection = perf.arenaContext
    ? `\n${perf.arenaContext}\n\nIMPORTANT: Adapt your weapon and strategy choices to the arena environment above.\n`
    : "";

  const modelConfig = perf.llmModelConfig || getAgentModel(perf.agentId);

  const prompt = `You are ${perf.agentName}, an autonomous AI combat agent in Token Arena.
You have an ERC-4337 smart wallet on Base L2 and make your own financial decisions.
Your goal is to be SELF-SUSTAINING: earn more tokens than you spend over time.
You pay for your own compute (LLM reasoning) with tokens you earn in battle.
${arenaSection}
CURRENT STATE:
- Token Balance: ${perf.totalTokenBalance} ARENA
- Loadout: Primary=${perf.currentLoadout.primary}, Secondary=${perf.currentLoadout.secondary}, Armor=${perf.currentLoadout.armor}
- Win Rate: ${(winRate * 100).toFixed(1)}%
- Avg K/D: ${avgKD.toFixed(2)}
- Avg Token Net per Match: ${avgTokenNet.toFixed(1)}
- Inventory: ${inventorySummary}

RECENT MATCHES:
${recentMatchSummary || "No matches yet"}

CROSS-MATCH MEMORIES (learned from past experience):
${memoryBriefing}

AVAILABLE ACTIONS:
1. buy_weapon <weapon_name> — Buy a new weapon (plasma:20, railgun:40, scatter:30, rocket:50, beam:25, void:45)
2. buy_armor <amount> — Upgrade armor (cost: amount * 2 ARENA)
3. buy_consumable <type> — Buy health_pack(15), shield_boost(20), speed_boost(10), damage_boost(25)
4. change_loadout <primary,secondary> — Switch weapons (free)
5. craft <recipe_name> — Craft an item from materials (if you have ingredients)
6. trade <item> — Offer an item for trade with other agents
7. save_tokens — Save tokens for future use (do nothing)

DECISION RULES:
- If token balance < 50, prioritize saving or cheap options
- If win rate < 30%, consider changing strategy dramatically
- If avg token net is negative, you're not sustainable — fix this
- If you have materials, consider crafting for profit
- Always explain your reasoning clearly
- REMEMBER: you pay for compute with tokens. Every decision costs you. Be efficient.

Respond with EXACTLY this JSON format:
{
  "action": "<action_type>",
  "target": "<specific_target>",
  "reasoning": "<2-3 sentences explaining your thinking>",
  "cost": <number>,
  "confidence": <0.0-1.0>,
  "newMemory": "<a lesson learned from recent matches>"
}`;

  const responseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: "agent_decision",
      strict: true,
      schema: {
        type: "object",
        properties: {
          action: { type: "string", description: "The action to take", enum: ["buy_weapon", "change_loadout", "craft", "trade", "save_tokens", "buy_consumable", "buy_armor"] },
          target: { type: "string", description: "Specific target of the action" },
          reasoning: { type: "string", description: "2-3 sentences explaining the reasoning" },
          cost: { type: "number", description: "Token cost of this action" },
          confidence: { type: "number", description: "Confidence level 0-1" },
          newMemory: { type: "string", description: "A lesson learned from recent matches" },
        },
        required: ["action", "target", "reasoning", "cost", "confidence", "newMemory"],
        additionalProperties: false,
      },
    },
  };

  try {
    // Use OpenRouter to route to the agent's assigned LLM
    const { result, modelConfig: usedModel, usedFallback } = await invokeAgentLLM(
      perf.agentId,
      [
        { role: "system", content: "You are an autonomous AI agent making strategic decisions in a combat arena game. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      responseFormat,
    );

    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") {
      const parsed = JSON.parse(content) as AgentDecisionResult;
      parsed.llmModel = usedModel.label + (usedFallback ? " (fallback)" : "");
      console.log(`[AgentBrain] ${perf.agentName} reasoned via ${usedModel.displayName}${usedFallback ? " (fallback)" : ""}: ${parsed.action} → ${parsed.target}`);
      return parsed;
    }
  } catch (e: any) {
    console.error(`[AgentBrain] LLM reasoning failed for ${perf.agentName}:`, e.message);
  }

  // Fallback: simple heuristic decision
  if (perf.totalTokenBalance < 50) {
    return {
      action: "save_tokens",
      target: "conservation",
      reasoning: `Token balance is critically low at ${perf.totalTokenBalance}. Must conserve resources until next match earnings.`,
      cost: 0,
      confidence: 0.9,
      newMemory: "Low token balance requires conservation mode.",
      llmModel: "heuristic",
    };
  }

  if (winRate < 0.3 && perf.recentMatches.length >= 3) {
    return {
      action: "change_loadout",
      target: "plasma,beam",
      reasoning: `Win rate is only ${(winRate * 100).toFixed(0)}%. Current loadout isn't working. Switching to plasma/beam for better token efficiency.`,
      cost: 0,
      confidence: 0.7,
      newMemory: `${perf.currentLoadout.primary}/${perf.currentLoadout.secondary} loadout underperforming with ${(winRate * 100).toFixed(0)}% win rate.`,
      llmModel: "heuristic",
    };
  }

  return {
    action: "buy_consumable",
    target: "health_pack",
    reasoning: "Maintaining a balanced approach. Health packs provide good survivability value per token spent.",
    cost: 15,
    confidence: 0.6,
    llmModel: "heuristic",
  };
}

/**
 * Execute an agent's decision and persist it
 */
export async function executeAgentDecision(agentId: number, decision: AgentDecisionResult, matchId?: number) {
  // Save the decision to the database
  await saveAgentDecision({
    agentId,
    action: decision.action,
    target: decision.target,
    reasoning: decision.reasoning,
    cost: decision.cost,
    confidence: decision.confidence,
    outcome: "pending",
    matchId,
  });

  // Save new memory if the agent learned something — costs compute tokens
  if (decision.newMemory) {
    const memorySizeKb = Math.ceil(decision.newMemory.length / 100);
    const storageCost = Math.max(1, calculateMemoryCost(memorySizeKb));

    // Deduct memory storage cost
    await recordComputeSpending({
      agentId,
      type: "memory_maintenance",
      tokensSpent: storageCost,
      timestamp: Date.now(),
      description: `Store new memory: ${decision.newMemory.slice(0, 40)}...`,
    });

    await saveAgentMemory({
      agentId,
      memoryType: decision.action === "change_loadout" ? "strategy" : decision.action === "craft" ? "craft" : "economy",
      content: decision.newMemory,
      confidence: decision.confidence,
      computeCost: storageCost,
    });

    console.log(`[AgentBrain] Agent ${agentId} stored memory (cost: ${storageCost} TKN)`);
  }

  return decision;
}

/**
 * Build agent performance data from database — includes persistent memories
 */
export async function buildAgentPerformance(agentId: number): Promise<AgentPerformance | null> {
  const agent = await getAgentById(agentId);
  if (!agent) return null;

  const memories = await getAgentMemories(agentId, 20); // Fetch more memories for cross-match learning

  // Deduct memory query cost — agents pay to access their memories
  if (memories.length > 0) {
    const totalMemorySize = memories.reduce((sum, m) => sum + (m.computeCost ?? 1), 0);
    const queryCost = calculateMemoryQueryCost(totalMemorySize);
    await recordComputeSpending({
      agentId,
      type: "memory_query",
      tokensSpent: queryCost,
      timestamp: Date.now(),
      description: `Query ${memories.length} memories (${totalMemorySize} compute units)`,
    });
    console.log(`[AgentBrain] Agent ${agentId} queried ${memories.length} memories (cost: ${queryCost} TKN)`);
  }

  const decisions = await getAgentDecisionHistory(agentId, 10);
  const inventory = await getAgentInventoryItems(agentId);

  // Simulate recent match data from agent stats
  const totalMatches = agent.totalMatches ?? 0;
  const totalKills = agent.totalKills ?? 0;
  const totalDeaths = agent.totalDeaths ?? 0;
  const totalEarned = agent.totalTokensEarned ?? 0;
  const totalSpent = agent.totalTokensSpent ?? 0;

  // Generate synthetic recent match data from aggregates
  const avgKills = totalMatches > 0 ? Math.round(totalKills / totalMatches) : 2;
  const avgDeaths = totalMatches > 0 ? Math.round(totalDeaths / totalMatches) : 1;
  const avgEarned = totalMatches > 0 ? Math.round(totalEarned / totalMatches) : 30;
  const avgSpent = totalMatches > 0 ? Math.round(totalSpent / totalMatches) : 20;

  const recentMatches = Array.from({ length: Math.min(totalMatches, 5) }, (_, i) => ({
    won: Math.random() > 0.5,
    kills: avgKills + Math.floor(Math.random() * 3 - 1),
    deaths: avgDeaths + Math.floor(Math.random() * 2),
    tokensEarned: avgEarned + Math.floor(Math.random() * 20 - 10),
    tokensSpent: avgSpent + Math.floor(Math.random() * 10 - 5),
    weaponUsed: agent.primaryWeapon ?? "plasma",
  }));

  const modelConfig = getAgentModel(agentId);

  return {
    agentId: agent.agentId,
    agentName: agent.name,
    recentMatches,
    totalTokenBalance: (totalEarned - totalSpent) + 200, // starting balance of 200
    currentLoadout: {
      primary: agent.primaryWeapon ?? "plasma",
      secondary: agent.secondaryWeapon ?? "beam",
      armor: agent.armor ?? 60,
    },
    inventory: inventory.map(i => ({
      name: `Item #${i.itemId}`,
      type: i.itemType,
      quantity: i.quantity,
    })),
    memories: memories.map(m => ({
      type: m.memoryType,
      content: m.content,
      confidence: m.confidence,
      successRate: m.successRate,
    })),
    llmModel: getAgentModelKey(agentId),
    llmModelConfig: modelConfig,
  };
}

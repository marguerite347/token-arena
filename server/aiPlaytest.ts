/**
 * AI Playtest Engine — Runs full agent battles server-side
 * 
 * Generates authentic match data with:
 * - LLM-powered agent reasoning for weapon/strategy decisions
 * - Simulated combat with realistic damage/kill mechanics
 * - Token economics (earnings, spending, compute costs)
 * - Memory formation from match outcomes
 * - Combat log generation
 */

import { invokeLLM } from "./_core/llm";
import { invokeAgentLLM, getAgentModel, getAgentModelKey } from "./openRouterLLM";
import { getDb, getAgentIdentities, updateAgentStats, logX402Transaction, saveMatch, upsertLeaderboardEntry, saveAgentMemory, saveAgentDecision } from "./db";
import { recordComputeSpend, recordFee } from "./daoCouncil";
import { ARENA_PROMPTS } from "../shared/arenaPrompts";
import { WEAPON_TOKENS } from "../shared/web3";
import { matchReplays } from "../drizzle/schema";

// ─── Types ──────────────────────────────────────────────────────

interface CombatAgent {
  agentId: number;
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  primaryWeapon: string;
  secondaryWeapon: string;
  tokenBalance: number;
  computeBudget: number;
  computeSpent: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  shotsFired: number;
  shotsHit: number;
  llmModel?: string;
  llmLabel?: string;
}

interface CombatLogEntry {
  tick: number;
  timestamp: number;
  type: "attack" | "kill" | "spawn" | "decision" | "economy" | "memory";
  actor: string;
  target?: string;
  weapon?: string;
  damage?: number;
  detail: string;
}

interface PlaytestMatchResult {
  matchId: number | null;
  arena: string;
  duration: number;
  replayId?: string;
  agents: Array<{
    agentId: number;
    name: string;
    kills: number;
    deaths: number;
    damageDealt: number;
    tokensEarned: number;
    tokensSpent: number;
    survived: boolean;
    decision?: string;
    llmModel?: string;
    llmIcon?: string;
  }>;
  combatLog: CombatLogEntry[];
  winner: string;
}

// ─── Weapon Stats ───────────────────────────────────────────────

const WEAPON_STATS: Record<string, { damage: number; fireRate: number; accuracy: number; costPerShot: number }> = {
  plasma: { damage: 15, fireRate: 4, accuracy: 0.7, costPerShot: 2 },
  railgun: { damage: 45, fireRate: 0.8, accuracy: 0.85, costPerShot: 8 },
  scatter: { damage: 25, fireRate: 2, accuracy: 0.6, costPerShot: 5 },
  rocket: { damage: 40, fireRate: 1, accuracy: 0.5, costPerShot: 10 },
  beam: { damage: 12, fireRate: 6, accuracy: 0.9, costPerShot: 3 },
  void: { damage: 50, fireRate: 1, accuracy: 0.4, costPerShot: 12 },
};

// ─── Combat Simulation ─────────────────────────────────────────

function simulateCombatTick(
  attacker: CombatAgent,
  defender: CombatAgent,
  tick: number,
  log: CombatLogEntry[],
): void {
  // Choose weapon based on range/situation
  const weapon = Math.random() > 0.3 ? attacker.primaryWeapon : attacker.secondaryWeapon;
  const stats = WEAPON_STATS[weapon] || WEAPON_STATS.plasma;

  // Fire rate check — not every tick results in a shot
  if (Math.random() > stats.fireRate / 6) return;

  attacker.shotsFired++;
  const hit = Math.random() < stats.accuracy;

  if (hit) {
    attacker.shotsHit++;
    // Armor reduces damage
    const armorReduction = Math.min(0.5, defender.armor / 200);
    const actualDamage = Math.round(stats.damage * (1 - armorReduction));
    defender.hp -= actualDamage;
    attacker.damageDealt += actualDamage;
    defender.damageTaken += actualDamage;

    log.push({
      tick,
      timestamp: Date.now(),
      type: "attack",
      actor: attacker.name,
      target: defender.name,
      weapon,
      damage: actualDamage,
      detail: `${attacker.name} hits ${defender.name} with ${weapon} for ${actualDamage} damage (${defender.hp}/${defender.maxHp} HP)`,
    });

    if (defender.hp <= 0) {
      attacker.kills++;
      defender.deaths++;
      log.push({
        tick,
        timestamp: Date.now(),
        type: "kill",
        actor: attacker.name,
        target: defender.name,
        weapon,
        detail: `${attacker.name} ELIMINATES ${defender.name} with ${weapon}!`,
      });
    }
  }
}

// ─── LLM Agent Decision ────────────────────────────────────────

async function getAgentDecision(agent: CombatAgent, arena: string, opponentName: string): Promise<{
  action: string;
  reasoning: string;
  memory: string;
  llmUsed: string;
}> {
  const responseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: "tactical_decision",
      strict: true,
      schema: {
        type: "object",
        properties: {
          action: { type: "string", description: "Tactical plan" },
          reasoning: { type: "string", description: "2-3 sentences of tactical reasoning" },
          memory: { type: "string", description: "A lesson to remember from this situation" },
        },
        required: ["action", "reasoning", "memory"],
        additionalProperties: false,
      },
    },
  };

  try {
    // Use OpenRouter to route to the agent's assigned LLM
    const { result, modelConfig, usedFallback } = await invokeAgentLLM(
      agent.agentId,
      [
        {
          role: "system",
          content: "You are an autonomous AI combat agent making a tactical decision before a match. You pay for your own compute with tokens you earn. Return JSON with: action (string), reasoning (string, 2-3 sentences), memory (string, a lesson to remember).",
        },
        {
          role: "user",
          content: `You are ${agent.name}. Arena: ${arena}. Opponent: ${opponentName}.
Your loadout: ${agent.primaryWeapon}/${agent.secondaryWeapon}, Armor: ${agent.armor}.
HP: ${agent.hp}/${agent.maxHp}. Token balance: ${agent.tokenBalance}. Compute remaining: ${agent.computeBudget - agent.computeSpent}.
Kills so far: ${agent.kills}. Deaths: ${agent.deaths}.

What's your tactical plan for this fight? Consider the arena environment and your opponent.`,
        },
      ],
      responseFormat,
    );

    const content = result.choices[0]?.message?.content;
    const llmUsed = modelConfig.displayName + (usedFallback ? " (fallback)" : "");
    if (typeof content === "string") {
      const parsed = JSON.parse(content);
      console.log(`[AIPlaytest] ${agent.name} reasoned via ${llmUsed}: ${parsed.action}`);
      return { ...parsed, llmUsed };
    }
  } catch (e: any) {
    console.error(`[AIPlaytest] LLM decision failed for ${agent.name}:`, e.message);
  }

  return {
    action: "aggressive_push",
    reasoning: `${agent.name} decides to push aggressively with ${agent.primaryWeapon}, leveraging superior firepower.`,
    memory: `Arena ${arena} requires adaptive positioning.`,
    llmUsed: "heuristic",
  };
}

// ─── Run a Single Playtest Match ────────────────────────────────

async function runPlaytestMatch(
  agent1Data: { agentId: number; name: string; primaryWeapon: string; secondaryWeapon: string; armor: number; tokenBalance: number; computeBudget: number; computeSpent: number },
  agent2Data: { agentId: number; name: string; primaryWeapon: string; secondaryWeapon: string; armor: number; tokenBalance: number; computeBudget: number; computeSpent: number },
  useLLM: boolean = true,
): Promise<PlaytestMatchResult> {
  const arena = ARENA_PROMPTS[Math.floor(Math.random() * ARENA_PROMPTS.length)];
  const combatLog: CombatLogEntry[] = [];

  // Initialize combat agents
  const model1 = getAgentModel(agent1Data.agentId);
  const model2 = getAgentModel(agent2Data.agentId);

  const agent1: CombatAgent = {
    ...agent1Data,
    hp: 100 + Math.floor(agent1Data.armor / 2),
    maxHp: 100 + Math.floor(agent1Data.armor / 2),
    kills: 0,
    deaths: 0,
    damageDealt: 0,
    damageTaken: 0,
    shotsFired: 0,
    shotsHit: 0,
    llmModel: getAgentModelKey(agent1Data.agentId),
    llmLabel: model1.label,
  };

  const agent2: CombatAgent = {
    ...agent2Data,
    hp: 100 + Math.floor(agent2Data.armor / 2),
    maxHp: 100 + Math.floor(agent2Data.armor / 2),
    kills: 0,
    deaths: 0,
    damageDealt: 0,
    damageTaken: 0,
    shotsFired: 0,
    shotsHit: 0,
    llmModel: getAgentModelKey(agent2Data.agentId),
    llmLabel: model2.label,
  };

  // Log match start
  combatLog.push({
    tick: 0,
    timestamp: Date.now(),
    type: "spawn",
    actor: "SYSTEM",
    detail: `Match begins in ${arena.name}! ${agent1.name} vs ${agent2.name}`,
  });

  // Pre-match LLM decisions (if enabled)
  let decision1 = { action: "aggressive", reasoning: "Default aggressive strategy", memory: "No specific lesson", llmUsed: "heuristic" };
  let decision2 = { action: "defensive", reasoning: "Default defensive strategy", memory: "No specific lesson", llmUsed: "heuristic" };

  if (useLLM) {
    try {
      // Record compute spend for reasoning
      await recordComputeSpend(agent1.agentId, "playtest_reasoning", 5, `Pre-match reasoning vs ${agent2.name} in ${arena.name}`);
      await recordComputeSpend(agent2.agentId, "playtest_reasoning", 5, `Pre-match reasoning vs ${agent1.name} in ${arena.name}`);

      [decision1, decision2] = await Promise.all([
        getAgentDecision(agent1, arena.name, agent2.name),
        getAgentDecision(agent2, arena.name, agent1.name),
      ]);
    } catch (e: any) {
      console.error("[AIPlaytest] LLM decisions failed, using defaults:", e.message);
    }
  }

  combatLog.push({
    tick: 0,
    timestamp: Date.now(),
    type: "decision",
    actor: agent1.name,
    detail: `${agent1.name}: "${decision1.reasoning}"`,
  });

  combatLog.push({
    tick: 0,
    timestamp: Date.now(),
    type: "decision",
    actor: agent2.name,
    detail: `${agent2.name}: "${decision2.reasoning}"`,
  });

  // Simulate combat — 60-120 ticks (representing ~60-120 seconds of gameplay)
  const maxTicks = 60 + Math.floor(Math.random() * 60);
  let rounds = 0;

  for (let tick = 1; tick <= maxTicks; tick++) {
    // Both agents alive — exchange fire
    if (agent1.hp > 0 && agent2.hp > 0) {
      simulateCombatTick(agent1, agent2, tick, combatLog);
      if (agent2.hp > 0) {
        simulateCombatTick(agent2, agent1, tick, combatLog);
      }
      rounds++;
    }

    // Check for respawn (agents get 1 respawn per match)
    if (agent1.hp <= 0 && agent1.deaths <= 1) {
      agent1.hp = Math.floor(agent1.maxHp * 0.6); // Respawn at 60% HP
      combatLog.push({
        tick,
        timestamp: Date.now(),
        type: "spawn",
        actor: agent1.name,
        detail: `${agent1.name} respawns with ${agent1.hp} HP`,
      });
    }
    if (agent2.hp <= 0 && agent2.deaths <= 1) {
      agent2.hp = Math.floor(agent2.maxHp * 0.6);
      combatLog.push({
        tick,
        timestamp: Date.now(),
        type: "spawn",
        actor: agent2.name,
        detail: `${agent2.name} respawns with ${agent2.hp} HP`,
      });
    }

    // Both dead twice = match over
    if (agent1.hp <= 0 && agent2.hp <= 0) break;
    if (agent1.deaths >= 2 || agent2.deaths >= 2) break;
  }

  // Determine winner
  const agent1Score = agent1.kills * 100 + agent1.damageDealt - agent1.deaths * 50;
  const agent2Score = agent2.kills * 100 + agent2.damageDealt - agent2.deaths * 50;
  const agent1Won = agent1Score >= agent2Score;
  const winner = agent1Won ? agent1.name : agent2.name;

  // Token economics
  const winnerEarnings = 50 + Math.floor(Math.random() * 100) + (agent1Won ? agent1.kills : agent2.kills) * 15;
  const loserEarnings = 10 + Math.floor(Math.random() * 30);
  const ammoCost1 = agent1.shotsFired * (WEAPON_STATS[agent1.primaryWeapon]?.costPerShot || 2);
  const ammoCost2 = agent2.shotsFired * (WEAPON_STATS[agent2.primaryWeapon]?.costPerShot || 2);
  const entryFee = 10;

  const agent1Earned = agent1Won ? winnerEarnings : loserEarnings;
  const agent2Earned = agent1Won ? loserEarnings : winnerEarnings;
  const agent1Spent = ammoCost1 + entryFee;
  const agent2Spent = ammoCost2 + entryFee;

  // Log economy events
  combatLog.push({
    tick: maxTicks,
    timestamp: Date.now(),
    type: "economy",
    actor: agent1.name,
    detail: `${agent1.name}: earned ${agent1Earned} ARENA, spent ${agent1Spent} ARENA (ammo: ${ammoCost1}, entry: ${entryFee})`,
  });
  combatLog.push({
    tick: maxTicks,
    timestamp: Date.now(),
    type: "economy",
    actor: agent2.name,
    detail: `${agent2.name}: earned ${agent2Earned} ARENA, spent ${agent2Spent} ARENA (ammo: ${ammoCost2}, entry: ${entryFee})`,
  });

  // Persist to database
  // 1. Update agent stats
  await updateAgentStats(agent1.agentId, {
    kills: agent1.kills,
    deaths: agent1.deaths,
    tokensEarned: agent1Earned,
    tokensSpent: agent1Spent,
  });
  await updateAgentStats(agent2.agentId, {
    kills: agent2.kills,
    deaths: agent2.deaths,
    tokensEarned: agent2Earned,
    tokensSpent: agent2Spent,
  });

  // 2. Save match record
  const matchId = await saveMatch({
    mode: "ai_playtest",
    duration: rounds,
    skyboxPrompt: arena.prompt,
    playerName: `${agent1.name} vs ${agent2.name}`,
    playerKills: agent1Won ? agent1.kills : agent2.kills,
    playerDeaths: agent1Won ? agent1.deaths : agent2.deaths,
    tokensEarned: agent1Won ? agent1Earned : agent2Earned,
    tokensSpent: agent1Won ? agent1Spent : agent2Spent,
    tokenNet: (agent1Won ? agent1Earned - agent1Spent : agent2Earned - agent2Spent),
    result: "completed",
    weaponUsed: agent1Won ? agent1.primaryWeapon : agent2.primaryWeapon,
    agentData: {
      agents: [
        { id: agent1.agentId, name: agent1.name, kills: agent1.kills, deaths: agent1.deaths, damage: agent1.damageDealt, won: agent1Won, llmModel: agent1.llmLabel || "unknown" },
        { id: agent2.agentId, name: agent2.name, kills: agent2.kills, deaths: agent2.deaths, damage: agent2.damageDealt, won: !agent1Won, llmModel: agent2.llmLabel || "unknown" },
      ],
      combatLogLength: combatLog.length,
      arena: arena.name,
      winner,
      decisions: { [agent1.name]: decision1.reasoning, [agent2.name]: decision2.reasoning },
      llmModels: { [agent1.name]: decision1.llmUsed, [agent2.name]: decision2.llmUsed },
    },
    entryFee: entryFee * 2,
  });

  // 3. Update leaderboards
  await upsertLeaderboardEntry({
    playerName: agent1.name,
    kills: agent1.kills,
    deaths: agent1.deaths,
    tokensEarned: agent1Earned,
    tokensSpent: agent1Spent,
    won: agent1Won,
    weapon: agent1.primaryWeapon,
  });
  await upsertLeaderboardEntry({
    playerName: agent2.name,
    kills: agent2.kills,
    deaths: agent2.deaths,
    tokensEarned: agent2Earned,
    tokensSpent: agent2Spent,
    won: !agent1Won,
    weapon: agent2.primaryWeapon,
  });

  // 4. Log x402 transactions
  const txBase = `playtest-${Date.now()}-${agent1.agentId}-${agent2.agentId}`;
  await logX402Transaction({
    paymentId: `${txBase}-earn1`,
    txHash: `0x${txBase.replace(/-/g, "")}e1`,
    action: "match_earnings",
    tokenSymbol: "ARENA",
    amount: agent1Earned,
    fromAddress: "0xArenaContract",
    toAddress: `agent_${agent1.agentId}`,
    matchId: matchId ?? undefined,
    agentId: agent1.agentId,
    feeAmount: 0,
    success: 1,
  });
  await logX402Transaction({
    paymentId: `${txBase}-earn2`,
    txHash: `0x${txBase.replace(/-/g, "")}e2`,
    action: "match_earnings",
    tokenSymbol: "ARENA",
    amount: agent2Earned,
    fromAddress: "0xArenaContract",
    toAddress: `agent_${agent2.agentId}`,
    matchId: matchId ?? undefined,
    agentId: agent2.agentId,
    feeAmount: 0,
    success: 1,
  });

  // 5. Record entry fees to treasury
  await recordFee("match_entry", entryFee * 2, `Playtest match entry: ${agent1.name} vs ${agent2.name}`, undefined, matchId ?? undefined);

  // 6. Save memories from match (if LLM was used)
  if (useLLM) {
    // Save agent decisions
    await saveAgentDecision({
      agentId: agent1.agentId,
      action: "playtest_strategy",
      target: decision1.action.slice(0, 64),
      reasoning: decision1.reasoning,
      cost: 5,
      confidence: 0.7,
      outcome: agent1Won ? "success" : "failure",
      matchId: matchId ?? undefined,
    });
    await saveAgentDecision({
      agentId: agent2.agentId,
      action: "playtest_strategy",
      target: decision2.action.slice(0, 64),
      reasoning: decision2.reasoning,
      cost: 5,
      confidence: 0.7,
      outcome: !agent1Won ? "success" : "failure",
      matchId: matchId ?? undefined,
    });

    // Save memories
    combatLog.push({
      tick: maxTicks,
      timestamp: Date.now(),
      type: "memory",
      actor: agent1.name,
      detail: `${agent1.name} remembers: "${decision1.memory}"`,
    });
    combatLog.push({
      tick: maxTicks,
      timestamp: Date.now(),
      type: "memory",
      actor: agent2.name,
      detail: `${agent2.name} remembers: "${decision2.memory}"`,
    });

    await saveAgentMemory({
      agentId: agent1.agentId,
      memoryType: agent1Won ? "strategy" : "failure",
      content: decision1.memory,
      confidence: agent1Won ? 0.8 : 0.5,
      computeCost: 1,
    });
    await saveAgentMemory({
      agentId: agent2.agentId,
      memoryType: !agent1Won ? "strategy" : "failure",
      content: decision2.memory,
      confidence: !agent1Won ? 0.8 : 0.5,
      computeCost: 1,
    });
  }

  // ─── Generate Synthetic Replay Data ────────────────────────────────────
  const replayId = `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const AGENT_COLORS: Record<string, string> = {
    "NEXUS-7": "#00f0ff", "PHANTOM": "#ff3366", "TITAN": "#39ff14",
    "ECHO": "#ffb800", "VIPER": "#9b59b6", "SENTINEL": "#e74c3c",
  };
  const a1Color = AGENT_COLORS[agent1.name] || "#00f0ff";
  const a2Color = AGENT_COLORS[agent2.name] || "#ff3366";

  // Generate frames from combat ticks — simulate positions
  const replayFrames: any[] = [];
  const replayEvents: any[] = [];
  const replayHighlights: any[] = [];
  let a1x = -8, a1z = 0, a2x = 8, a2z = 0;
  let a1hp = agent1.maxHp, a2hp = agent2.maxHp;
  let frameKillCount = 0;

  for (let tick = 0; tick <= maxTicks; tick++) {
    const t = tick * 1000; // ms
    // Simulate movement — agents circle and approach each other
    const angle1 = tick * 0.05 + Math.sin(tick * 0.02) * 2;
    const angle2 = tick * 0.05 + Math.PI + Math.cos(tick * 0.03) * 2;
    const radius = Math.max(3, 10 - tick * 0.05);
    a1x = Math.cos(angle1) * radius + (Math.random() - 0.5) * 0.5;
    a1z = Math.sin(angle1) * radius + (Math.random() - 0.5) * 0.5;
    a2x = Math.cos(angle2) * radius + (Math.random() - 0.5) * 0.5;
    a2z = Math.sin(angle2) * radius + (Math.random() - 0.5) * 0.5;

    // Update HP from combat log events at this tick
    const tickEvents = combatLog.filter(e => e.tick === tick);
    for (const evt of tickEvents) {
      if (evt.type === "attack" && evt.target === agent1.name) a1hp = Math.max(0, a1hp - (evt.damage || 0));
      if (evt.type === "attack" && evt.target === agent2.name) a2hp = Math.max(0, a2hp - (evt.damage || 0));
      if (evt.type === "kill") {
        frameKillCount++;
        replayEvents.push({ type: "kill", timestamp: t, data: { killerName: evt.actor, victimName: evt.target, weapon: evt.weapon } });
        if (frameKillCount === 1) {
          replayHighlights.push({ timestamp: t, duration: 3000, type: "first_blood", title: "FIRST BLOOD", description: `${evt.actor} draws first blood on ${evt.target}!`, involvedAgents: [evt.actor, evt.target || ""], importance: 7 });
        }
      }
      if (evt.type === "spawn" && evt.actor !== "SYSTEM") {
        if (evt.actor === agent1.name) a1hp = Math.floor(agent1.maxHp * 0.6);
        if (evt.actor === agent2.name) a2hp = Math.floor(agent2.maxHp * 0.6);
      }
    }

    // Record frame every 3 ticks (like 10fps)
    if (tick % 3 === 0) {
      replayFrames.push({
        timestamp: t,
        agents: [
          { id: `agent-${agent1.agentId}`, name: agent1.name, x: a1x, y: 0, z: a1z, rotation: Math.atan2(a2x - a1x, a2z - a1z), health: Math.max(0, a1hp), maxHealth: agent1.maxHp, tokens: agent1.tokenBalance, weapon: agent1.primaryWeapon, isAlive: a1hp > 0, kills: agent1.kills, color: a1Color },
          { id: `agent-${agent2.agentId}`, name: agent2.name, x: a2x, y: 0, z: a2z, rotation: Math.atan2(a1x - a2x, a1z - a2z), health: Math.max(0, a2hp), maxHealth: agent2.maxHp, tokens: agent2.tokenBalance, weapon: agent2.primaryWeapon, isAlive: a2hp > 0, kills: agent2.kills, color: a2Color },
        ],
        projectiles: [],
      });
    }
  }

  // Add match end highlight
  replayHighlights.push({
    timestamp: maxTicks * 1000,
    duration: 5000,
    type: "clutch",
    title: `${winner} WINS!`,
    description: `${winner} claims victory with ${agent1Won ? agent1.kills : agent2.kills} kills!`,
    involvedAgents: [winner],
    importance: 10,
  });

  // Save replay to database
  try {
    const db = await getDb();
    if (db) {
      await db.insert(matchReplays).values({
        matchId: matchId ?? undefined,
        replayId,
        mode: "ai_playtest",
        duration: maxTicks * 1000,
        totalKills: agent1.kills + agent2.kills,
        mvpName: winner,
        mvpKills: agent1Won ? agent1.kills : agent2.kills,
        mvpTokens: agent1Won ? agent1Earned : agent2Earned,
        result: `${winner} wins`,
        skyboxPrompt: arena.prompt,
        agents: [{ id: `agent-${agent1.agentId}`, name: agent1.name, color: a1Color }, { id: `agent-${agent2.agentId}`, name: agent2.name, color: a2Color }],
        highlights: replayHighlights,
        events: replayEvents,
        frames: replayFrames,
        combatLog: combatLog,
      });
      console.log(`[AIPlaytest] Replay saved: ${replayId}`);
    }
  } catch (e: any) {
    console.error(`[AIPlaytest] Failed to save replay:`, e.message);
  }

  return {
    matchId,
    arena: arena.name,
    duration: rounds,
    replayId,
    agents: [
      {
        agentId: agent1.agentId,
        name: agent1.name,
        kills: agent1.kills,
        deaths: agent1.deaths,
        damageDealt: agent1.damageDealt,
        tokensEarned: agent1Earned,
        tokensSpent: agent1Spent,
        survived: agent1.hp > 0,
        decision: decision1.reasoning,
        llmModel: agent1.llmLabel || decision1.llmUsed || "Manus LLM",
        llmIcon: agent1.llmModel ? getAgentModel(agent1.agentId).icon : "🤖",
      },
      {
        agentId: agent2.agentId,
        name: agent2.name,
        kills: agent2.kills,
        deaths: agent2.deaths,
        damageDealt: agent2.damageDealt,
        tokensEarned: agent2Earned,
        tokensSpent: agent2Spent,
        survived: agent2.hp > 0,
        decision: decision2.reasoning,
        llmModel: agent2.llmLabel || decision2.llmUsed || "Manus LLM",
        llmIcon: agent2.llmModel ? getAgentModel(agent2.agentId).icon : "🤖",
      },
    ],
    combatLog,
    winner,
  };
}

// ─── Run Full Playtest Session ──────────────────────────────────

export async function runPlaytestSession(
  matchCount: number = 5,
  useLLM: boolean = true,
): Promise<{
  matchesPlayed: number;
  results: PlaytestMatchResult[];
  summary: {
    totalKills: number;
    totalTokensEarned: number;
    totalTokensSpent: number;
    mvp: string;
    bestKD: string;
    arenaBreakdown: Record<string, number>;
  };
}> {
  const agents = await getAgentIdentities();
  if (agents.length < 2) {
    throw new Error("Need at least 2 agents to run playtests");
  }

  const results: PlaytestMatchResult[] = [];
  const agentKills: Record<string, number> = {};
  const agentDeaths: Record<string, number> = {};
  const arenaBreakdown: Record<string, number> = {};
  let totalKills = 0;
  let totalEarned = 0;
  let totalSpent = 0;

  for (let i = 0; i < matchCount; i++) {
    // Pick two different agents randomly
    const shuffled = [...agents].sort(() => Math.random() - 0.5);
    const a1 = shuffled[0];
    const a2 = shuffled[1];

    console.log(`[AIPlaytest] Match ${i + 1}/${matchCount}: ${a1.name} vs ${a2.name}`);

    const result = await runPlaytestMatch(
      {
        agentId: a1.agentId,
        name: a1.name,
        primaryWeapon: a1.primaryWeapon || "plasma",
        secondaryWeapon: a1.secondaryWeapon || "beam",
        armor: a1.armor ?? 60,
        tokenBalance: (a1.totalTokensEarned ?? 0) - (a1.totalTokensSpent ?? 0),
        computeBudget: a1.computeBudget ?? 1000,
        computeSpent: a1.computeSpent ?? 0,
      },
      {
        agentId: a2.agentId,
        name: a2.name,
        primaryWeapon: a2.primaryWeapon || "plasma",
        secondaryWeapon: a2.secondaryWeapon || "beam",
        armor: a2.armor ?? 60,
        tokenBalance: (a2.totalTokensEarned ?? 0) - (a2.totalTokensSpent ?? 0),
        computeBudget: a2.computeBudget ?? 1000,
        computeSpent: a2.computeSpent ?? 0,
      },
      useLLM,
    );

    results.push(result);

    // Aggregate stats
    for (const agent of result.agents) {
      agentKills[agent.name] = (agentKills[agent.name] || 0) + agent.kills;
      agentDeaths[agent.name] = (agentDeaths[agent.name] || 0) + agent.deaths;
      totalKills += agent.kills;
      totalEarned += agent.tokensEarned;
      totalSpent += agent.tokensSpent;
    }
    arenaBreakdown[result.arena] = (arenaBreakdown[result.arena] || 0) + 1;
  }

  // Find MVP (most kills) and best K/D
  const mvp = Object.entries(agentKills).sort(([, a], [, b]) => b - a)[0]?.[0] || "Unknown";
  const bestKD = Object.entries(agentKills)
    .map(([name, kills]) => ({ name, kd: kills / Math.max(1, agentDeaths[name] || 1) }))
    .sort((a, b) => b.kd - a.kd)[0]?.name || "Unknown";

  return {
    matchesPlayed: results.length,
    results,
    summary: {
      totalKills,
      totalTokensEarned: totalEarned,
      totalTokensSpent: totalSpent,
      mvp,
      bestKD,
      arenaBreakdown,
    },
  };
}

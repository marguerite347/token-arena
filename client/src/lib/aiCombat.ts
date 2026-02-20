/**
 * Smart AI Combat Engine — Makes AI agents fight intelligently
 * 
 * Features:
 * - Priority targeting: focus low-health enemies, avoid overkill
 * - Evasion maneuvers: dodge when under fire, strafe unpredictably
 * - Dynamic weapon switching: range-based weapon selection
 * - Personality-driven combat: aggressive, defensive, opportunist, berserker
 */

import { type Agent, type Projectile, type WeaponType, WEAPONS } from "@/contexts/GameContext";

// ─── Agent Personality Types ────────────────────────────────────────────────
export type CombatPersonality = "aggressive" | "defensive" | "opportunist" | "berserker" | "sniper" | "tactician";

interface PersonalityTraits {
  engageRange: number;       // Preferred combat range
  retreatHealthPct: number;  // HP% to start retreating
  aggression: number;        // 0-1, fire rate multiplier
  evasiveness: number;       // 0-1, dodge frequency
  targetPriority: "nearest" | "weakest" | "strongest" | "richest";
  preferredRange: "close" | "mid" | "far";
  strafeFrequency: number;   // 0-1, how often to strafe
  weaponSwitchFrequency: number; // 0-1, how often to consider switching
}

const PERSONALITIES: Record<CombatPersonality, PersonalityTraits> = {
  aggressive: {
    engageRange: 12, retreatHealthPct: 0.15, aggression: 0.08,
    evasiveness: 0.3, targetPriority: "nearest", preferredRange: "close",
    strafeFrequency: 0.4, weaponSwitchFrequency: 0.3,
  },
  defensive: {
    engageRange: 14, retreatHealthPct: 0.4, aggression: 0.04,
    evasiveness: 0.7, targetPriority: "weakest", preferredRange: "far",
    strafeFrequency: 0.6, weaponSwitchFrequency: 0.2,
  },
  opportunist: {
    engageRange: 13, retreatHealthPct: 0.25, aggression: 0.06,
    evasiveness: 0.5, targetPriority: "weakest", preferredRange: "mid",
    strafeFrequency: 0.5, weaponSwitchFrequency: 0.5,
  },
  berserker: {
    engageRange: 8, retreatHealthPct: 0.05, aggression: 0.12,
    evasiveness: 0.1, targetPriority: "nearest", preferredRange: "close",
    strafeFrequency: 0.2, weaponSwitchFrequency: 0.1,
  },
  sniper: {
    engageRange: 16, retreatHealthPct: 0.3, aggression: 0.03,
    evasiveness: 0.6, targetPriority: "strongest", preferredRange: "far",
    strafeFrequency: 0.7, weaponSwitchFrequency: 0.4,
  },
  tactician: {
    engageRange: 11, retreatHealthPct: 0.3, aggression: 0.05,
    evasiveness: 0.5, targetPriority: "richest", preferredRange: "mid",
    strafeFrequency: 0.5, weaponSwitchFrequency: 0.6,
  },
};

// Assign personality based on agent index for consistency
const PERSONALITY_ORDER: CombatPersonality[] = [
  "aggressive", "sniper", "opportunist", "berserker", "defensive", "tactician", "aggressive", "sniper",
];

// ─── Per-agent state (persists across frames) ───────────────────────────────
interface AgentCombatState {
  personality: CombatPersonality;
  traits: PersonalityTraits;
  strafeDir: number;          // -1 or 1
  strafeTimer: number;        // seconds until strafe direction change
  lastFireTime: number;       // timestamp of last shot
  dodgeTimer: number;         // seconds of active dodge
  dodgeDir: { x: number; z: number };
  currentTarget: string | null;
  targetLockTimer: number;    // seconds before re-evaluating target
  weaponSwitchCooldown: number;
  lastDamagedBy: string | null;
  consecutiveHits: number;
  missStreak: number;
}

const agentStates = new Map<string, AgentCombatState>();

function getAgentState(agent: Agent, index: number): AgentCombatState {
  let s = agentStates.get(agent.id);
  if (!s) {
    const personality = PERSONALITY_ORDER[index % PERSONALITY_ORDER.length];
    s = {
      personality,
      traits: PERSONALITIES[personality],
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeTimer: 1 + Math.random() * 2,
      lastFireTime: 0,
      dodgeTimer: 0,
      dodgeDir: { x: 0, z: 0 },
      currentTarget: null,
      targetLockTimer: 0,
      weaponSwitchCooldown: 0,
    lastDamagedBy: null,
      consecutiveHits: 0,
      missStreak: 0,
    };
    agentStates.set(agent.id, s);
  }
  return s;
}

export function resetAgentStates() {
  agentStates.clear();
}

// ─── Target Selection ───────────────────────────────────────────────────────
function selectTarget(
  agent: Agent,
  targets: Agent[],
  state: AgentCombatState,
): Agent | null {
  if (targets.length === 0) return null;

  // Keep current target if still valid and lock timer hasn't expired
  if (state.currentTarget && state.targetLockTimer > 0) {
    const current = targets.find(t => t.id === state.currentTarget && t.isAlive);
    if (current) return current;
  }

  // Prioritize whoever just damaged us (revenge targeting)
  if (state.lastDamagedBy) {
    const attacker = targets.find(t => t.id === state.lastDamagedBy && t.isAlive);
    if (attacker) {
      const dx = attacker.x - agent.x, dz = attacker.z - agent.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 15) return attacker;
    }
  }

  // Score each target based on personality
  let bestTarget = targets[0];
  let bestScore = -Infinity;

  for (const t of targets) {
    const dx = t.x - agent.x, dz = t.z - agent.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 20) continue; // Too far

    let score = 0;

    switch (state.traits.targetPriority) {
      case "nearest":
        score = 20 - dist; // Closer = higher score
        break;
      case "weakest":
        score = (1 - t.health / t.maxHealth) * 20; // Lower HP% = higher score
        // Big bonus for almost-dead targets (finish them off!)
        if (t.health < 25) score += 15;
        break;
      case "strongest":
        score = (t.health / t.maxHealth) * 10 + t.kills * 3; // Higher threat = higher score
        break;
      case "richest":
        score = t.tokens / 50; // More tokens = more valuable kill
        break;
    }

    // Range preference bonus
    const rangeDiff = Math.abs(dist - state.traits.engageRange);
    score -= rangeDiff * 0.5;

    // Bonus for low-health targets regardless of personality (opportunistic finish)
    if (t.health / t.maxHealth < 0.2) score += 10;

    if (score > bestScore) {
      bestScore = score;
      bestTarget = t;
    }
  }

  return bestTarget;
}

// ─── Weapon Selection ───────────────────────────────────────────────────────
function selectWeapon(agent: Agent, target: Agent, dist: number, state: AgentCombatState): WeaponType {
  // Don't switch too often
  if (state.weaponSwitchCooldown > 0) return agent.weapon.type;

  // Available weapons (all agents have access to all weapons in AI mode)
  const options: { type: WeaponType; score: number }[] = [];

  for (const [type, w] of Object.entries(WEAPONS) as [WeaponType, typeof WEAPONS.plasma][]) {
    // Can't afford it
    if (agent.tokens < w.tokenCost * 3) continue; // Need at least 3 shots worth

    let score = 0;

    // Range-based scoring
    if (dist < 4) {
      // Close range: scatter, nova, beam
      if (type === "scatter") score += 8;
      if (type === "nova") score += 10;
      if (type === "beam") score += 6;
      if (type === "plasma") score += 4;
    } else if (dist < 8) {
      // Mid range: plasma, scatter, missile
      if (type === "plasma") score += 7;
      if (type === "scatter") score += 5;
      if (type === "missile") score += 6;
      if (type === "beam") score += 4;
    } else {
      // Long range: railgun, missile, beam
      if (type === "railgun") score += 9;
      if (type === "missile") score += 6;
      if (type === "beam") score += 5;
      if (type === "plasma") score += 3;
    }

    // Low-health target: prefer high-damage to finish
    if (target.health < 30) {
      if (type === "railgun") score += 5;
      if (type === "missile") score += 3;
    }

    // Token efficiency when running low
    if (agent.tokens < 50) {
      score += (10 - w.tokenCost) * 0.5; // Prefer cheaper weapons
    }

    // DPS consideration
    const dps = (w.damage / (w.fireRate / 1000));
    score += dps * 0.1;

    options.push({ type, score });
  }

  if (options.length === 0) return "plasma"; // Fallback

  options.sort((a, b) => b.score - a.score);
  return options[0].type;
}

// ─── Movement AI ────────────────────────────────────────────────────────────
interface MovementResult {
  x: number;
  z: number;
  rotation: number;
}

function computeMovement(
  agent: Agent,
  target: Agent,
  allAgents: Agent[],
  projectiles: Projectile[],
  state: AgentCombatState,
  dt: number,
): MovementResult {
  const dx = target.x - agent.x;
  const dz = target.z - agent.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const tAngle = Math.atan2(dx, dz);

  // Smooth rotation towards target
  let newRot = agent.rotation;
  let aDiff = tAngle - agent.rotation;
  // Normalize angle difference to [-PI, PI]
  while (aDiff > Math.PI) aDiff -= Math.PI * 2;
  while (aDiff < -Math.PI) aDiff += Math.PI * 2;
  const rotSpeed = 4 * dt; // Faster rotation for responsiveness
  newRot += Math.sign(aDiff) * Math.min(Math.abs(aDiff), rotSpeed);

  const traits = state.traits;
  const baseSpeed = 3.5 * dt;
  let nx = agent.x;
  let nz = agent.z;

  // ─── Evasion: dodge incoming projectiles ──────────────────────────────
  const incomingThreats = projectiles.filter(p => {
    if (p.ownerId === agent.id) return false;
    const pdx = agent.x - p.x, pdz = agent.z - p.z;
    const pDist = Math.sqrt(pdx * pdx + pdz * pdz);
    if (pDist > 8) return false;
    // Check if projectile is heading towards us
    const dot = pdx * p.vx + pdz * p.vz;
    return dot > 0; // Moving towards us
  });

  if (incomingThreats.length > 0 && Math.random() < traits.evasiveness) {
    // Dodge perpendicular to incoming projectile
    const threat = incomingThreats[0];
    const perpX = -threat.vz;
    const perpZ = threat.vx;
    const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
    if (perpLen > 0) {
      state.dodgeTimer = 0.3;
      state.dodgeDir = { x: (perpX / perpLen) * state.strafeDir, z: (perpZ / perpLen) * state.strafeDir };
    }
  }

  // Active dodge movement
  if (state.dodgeTimer > 0) {
    const dodgeSpeed = baseSpeed * 2; // Dodge is faster
    nx += state.dodgeDir.x * dodgeSpeed;
    nz += state.dodgeDir.z * dodgeSpeed;
    state.dodgeTimer -= dt;
  } else {
    // ─── Health-based retreat ──────────────────────────────────────────
    const healthPct = agent.health / agent.maxHealth;
    if (healthPct < traits.retreatHealthPct && dist < 8) {
      // Run away from target
      const retreatX = -dx / dist;
      const retreatZ = -dz / dist;
      nx += retreatX * baseSpeed * 1.2;
      nz += retreatZ * baseSpeed * 1.2;
    }
    // ─── Range management ─────────────────────────────────────────────
    else if (dist > traits.engageRange + 2) {
      // Close distance
      nx += Math.sin(newRot) * baseSpeed;
      nz += Math.cos(newRot) * baseSpeed;
    } else if (dist < traits.engageRange - 3) {
      // Back away (maintain preferred range)
      nx -= Math.sin(newRot) * baseSpeed * 0.6;
      nz -= Math.cos(newRot) * baseSpeed * 0.6;
    }

    // ─── Strafing ─────────────────────────────────────────────────────
    state.strafeTimer -= dt;
    if (state.strafeTimer <= 0) {
      state.strafeDir *= -1;
      state.strafeTimer = 0.8 + Math.random() * 2;
    }

    if (Math.random() < traits.strafeFrequency) {
      const strafeX = Math.cos(newRot) * baseSpeed * 0.8 * state.strafeDir;
      const strafeZ = -Math.sin(newRot) * baseSpeed * 0.8 * state.strafeDir;
      nx += strafeX;
      nz += strafeZ;
    }
  }

  // ─── Avoid other agents (collision avoidance) ───────────────────────
  for (const other of allAgents) {
    if (other.id === agent.id || !other.isAlive) continue;
    const odx = nx - other.x, odz = nz - other.z;
    const oDist = Math.sqrt(odx * odx + odz * odz);
    if (oDist < 2 && oDist > 0) {
      // Push away
      nx += (odx / oDist) * baseSpeed * 0.5;
      nz += (odz / oDist) * baseSpeed * 0.5;
    }
  }

  // ─── Arena boundary ─────────────────────────────────────────────────
  const bDist = Math.sqrt(nx * nx + nz * nz);
  if (bDist > 17) {
    nx *= 17 / bDist;
    nz *= 17 / bDist;
  }

  return { x: nx, z: nz, rotation: newRot };
}

// ─── Firing Decision ────────────────────────────────────────────────────────
interface FireDecision {
  shouldFire: boolean;
  target: Agent;
  weaponType: WeaponType;
  aimOffset: { x: number; y: number; z: number }; // Accuracy spread
}

function decideFire(
  agent: Agent,
  target: Agent,
  targets: Agent[],
  state: AgentCombatState,
  now: number,
): FireDecision | null {
  if (agent.tokens < agent.weapon.tokenCost) return null;

  const dx = target.x - agent.x, dz = target.z - agent.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Out of range
  if (dist > 16 || dist < 0.5) return null;

  // Fire rate check (personality-adjusted)
  const fireChance = state.traits.aggression;
  if (Math.random() > fireChance) return null;

  // Weapon fire rate cooldown
  if (now - state.lastFireTime < agent.weapon.fireRate) return null;

  // Weapon switching
  if (Math.random() < state.traits.weaponSwitchFrequency * 0.02) {
    const newWeapon = selectWeapon(agent, target, dist, state);
    if (newWeapon !== agent.weapon.type) {
      state.weaponSwitchCooldown = 3; // 3 second cooldown after switch
      return { shouldFire: false, target, weaponType: newWeapon, aimOffset: { x: 0, y: 0, z: 0 } };
    }
  }

  // Lead target (predict movement) — smarter agents lead more accurately
  const leadFactor = state.personality === "sniper" ? 0.8 : state.personality === "tactician" ? 0.6 : 0.3;
  const travelTime = dist / agent.weapon.projectileSpeed;

  // Estimate target velocity from position (simple approximation)
  const leadX = dx + (Math.random() - 0.5) * 2 * (1 - leadFactor);
  const leadZ = dz + (Math.random() - 0.5) * 2 * (1 - leadFactor);

  // Accuracy based on personality and distance
  const baseSpread = 0.1;
  const distSpread = dist * 0.01;
  const personalitySpread = state.personality === "sniper" ? 0.05 : state.personality === "berserker" ? 0.2 : 0.12;
  const totalSpread = baseSpread + distSpread + personalitySpread;

  state.lastFireTime = now;

  return {
    shouldFire: true,
    target,
    weaponType: agent.weapon.type,
    aimOffset: {
      x: (Math.random() - 0.5) * totalSpread,
      y: (Math.random() - 0.5) * totalSpread * 0.5,
      z: (Math.random() - 0.5) * totalSpread,
    },
  };
}

// ─── Main AI Update Function ────────────────────────────────────────────────
export interface AIAction {
  agentId: string;
  movement: MovementResult;
  fire: FireDecision | null;
  weaponSwitch: WeaponType | null;
  personality: CombatPersonality;
}

export function updateAgentAI(
  agent: Agent,
  agentIndex: number,
  allAgents: Agent[],
  player: Agent,
  projectiles: Projectile[],
  mode: "pvai" | "aivai",
  dt: number,
): AIAction | null {
  if (!agent.isAlive) return null;

  const state = getAgentState(agent, agentIndex);

  // Update timers
  state.targetLockTimer = Math.max(0, state.targetLockTimer - dt);
  state.weaponSwitchCooldown = Math.max(0, state.weaponSwitchCooldown - dt);

  // Build target list
  const targets = mode === "aivai"
    ? allAgents.filter(a => a.id !== agent.id && a.isAlive)
    : [player, ...allAgents.filter(a => a.id !== agent.id && a.isAlive)].filter(a => a.isAlive);

  if (targets.length === 0) return null;

  // Select target
  const target = selectTarget(agent, targets, state);
  if (!target) return null;

  state.currentTarget = target.id;
  state.targetLockTimer = 2 + Math.random() * 3; // Lock for 2-5 seconds

  // Compute movement
  const movement = computeMovement(agent, target, allAgents, projectiles, state, dt);

  // Decide firing
  const now = Date.now();
  const fire = decideFire(agent, target, targets, state, now);

  // Weapon switch (from fire decision or periodic check)
  let weaponSwitch: WeaponType | null = null;
  if (fire && !fire.shouldFire && fire.weaponType !== agent.weapon.type) {
    weaponSwitch = fire.weaponType;
  }

  return {
    agentId: agent.id,
    movement,
    fire: fire?.shouldFire ? fire : null,
    weaponSwitch,
    personality: state.personality,
  };
}

// ─── Notify AI of damage (for revenge targeting) ────────────────────────────
export function notifyAgentDamaged(agentId: string, attackerId: string) {
  const state = agentStates.get(agentId);
  if (state) {
    state.lastDamagedBy = attackerId;
  }
}

/**
 * WatchMode — Full Spectator Gameplay Loop (v39)
 *
 * Flow: Agent Select → Combat → Intermission (earnings/inventory/DAO/betting) → Next Combat → ...
 *
 * Enhancements in v39:
 * - Real-time Skybox Model 4 generation via staging API (background generation during gameplay)
 * - Tiered arena platforms (Roblox RIVALS style) with cover/traversal
 * - Dynamic action camera: follows combat, zooms on kills, pans during action
 * - Dynamic betting: new bets each match based on combat results, social layer
 * - Game Master DAO agents with council influence
 * - Enhanced DAO proposals that change each match
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
} from "postprocessing";
import gsap from "gsap";

// ─── CDN fallback panoramas (used when real-time generation unavailable) ────
const FALLBACK_PANORAMAS = [
  { name: "Cyberpunk Arena", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/gyluRUvZGNaXfxyf.jpg" },
  { name: "Neon Brutalism", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/sNuAtMqlxnNqsqEE.jpg" },
  { name: "Mech Hangar", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/gOkcBobLWwNqWJlr.jpg" },
  { name: "Crypto Wasteland", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/dRjHDiDQqVzLFNjG.jpg" },
  { name: "SciFi Battleground", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/tVCUBUdNNPwxMTvN.jpg" },
  { name: "UE Render Arena", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/ybRsYGSbEaljmdEq.jpg" },
];

// ─── Skybox Model 4 arena prompts for real-time generation ──────────────────
const M4_ARENA_PROMPTS = [
  { name: "Neon Colosseum", prompt: "Massive cyberpunk colosseum arena with neon cyan and magenta energy barriers, floating hexagonal platforms over a dark abyss, holographic scoreboards, particle effects, dark atmospheric fog with volumetric neon lighting, brutalist architecture", styleId: 188 },
  { name: "Void Nexus", prompt: "Abstract digital void space with floating geometric platforms, holographic grid floor extending to infinity, neon wireframe structures, data particles streaming upward, deep black space with cyan and magenta nebula, cinematic quality", styleId: 186 },
  { name: "Mech Forge", prompt: "Industrial mech hangar bay with massive robotic suits in repair bays, sparking welding equipment, ammunition crates, neon warning lights, steam and smoke, brutalist concrete and steel architecture", styleId: 185 },
  { name: "Dark Citadel", prompt: "Dark fantasy citadel arena with obsidian towers, floating rune circles, purple lightning strikes, ancient stone platforms covered in glowing sigils, ominous sky with swirling dark clouds", styleId: 179 },
  { name: "Quantum Lab", prompt: "Futuristic quantum computing laboratory arena, walls of holographic data streams, floating quantum processors, blue and white sterile lighting, glass floors revealing circuitry below, sci-fi render", styleId: 177 },
  { name: "Wasteland Pit", prompt: "Post-apocalyptic fighting pit arena, rusted metal walls, toxic green pools, makeshift platforms from scrap metal, neon graffiti, dark stormy sky with digital aurora, dystopian render", styleId: 178 },
  { name: "Crystal Cavern", prompt: "Underground crystal cavern arena, massive glowing crystals in purple and cyan, reflective water pools, bioluminescent fungi on cave walls, ethereal mist, fantasy render", styleId: 187 },
  { name: "Orbital Station", prompt: "Space station combat arena orbiting a gas giant, transparent floor showing planet below, zero-gravity debris floating, holographic barriers, emergency red and blue lighting, sci-fi render", styleId: 177 },
];

// ─── Agent definitions with full metadata ───────────────────────────────────
const AGENTS = [
  {
    id: "NEXUS-7", color: 0x00ffff, emissive: 0x003333, shape: "robot", scale: 1.0,
    llm: "Claude 3.5 Sonnet", style: "Aggressive", role: "Precision Striker",
    desc: "Railgun specialist. Calculated high-damage strikes with ERC-4337 autonomous wallet.",
    loadout: { primary: "Railgun", secondary: "Plasma", armor: 80 },
    personality: "aggressive",
  },
  {
    id: "PHANTOM", color: 0x00ff88, emissive: 0x003322, shape: "soldier", scale: 1.1,
    llm: "GPT-4o", style: "Evasive", role: "Stealth Operative",
    desc: "Beam weapons for sustained pressure. Evasive and unpredictable movement.",
    loadout: { primary: "Laser Rifle", secondary: "Scatter", armor: 50 },
    personality: "evasive",
  },
  {
    id: "TITAN", color: 0xaa44ff, emissive: 0x220044, shape: "beast", scale: 1.4,
    llm: "Llama 3.1 70B", style: "Defensive", role: "Heavy Tank",
    desc: "Maximum armor, area denial. Invests heavily in defensive upgrades.",
    loadout: { primary: "Rocket Launcher", secondary: "Scatter", armor: 120 },
    personality: "defensive",
  },
  {
    id: "CIPHER", color: 0x4488ff, emissive: 0x002244, shape: "mech", scale: 1.2,
    llm: "Mistral Large", style: "Chaotic", role: "Exotic Specialist",
    desc: "Void energy weapons. Unpredictable burst damage. Risk-tolerant spending.",
    loadout: { primary: "Void Cannon", secondary: "Laser Rifle", armor: 60 },
    personality: "chaotic",
  },
  {
    id: "AURORA", color: 0x44ffdd, emissive: 0x003333, shape: "speeder", scale: 0.9,
    llm: "Gemini Flash", style: "Adaptive", role: "Balanced Fighter",
    desc: "Switches weapons based on opponent behavior and token economy.",
    loadout: { primary: "Plasma Pistol", secondary: "Railgun", armor: 70 },
    personality: "adaptive",
  },
  {
    id: "WRAITH", color: 0xff44aa, emissive: 0x330022, shape: "ghost", scale: 1.0,
    llm: "DeepSeek V3", style: "Aggressive", role: "Speed Assassin",
    desc: "Rapid plasma fire and evasion. Low armor, high mobility, token-efficient.",
    loadout: { primary: "Plasma Pistol", secondary: "Laser Rifle", armor: 40 },
    personality: "aggressive",
  },
];

// ─── Game Master DAO Council Agents ─────────────────────────────────────────
const GAME_MASTERS = [
  { id: "ARBITER", role: "Chief Arbiter", color: "#ffd700", desc: "Oversees match rules and resolves disputes. Has veto power on weapon balance proposals.", votingWeight: 3 },
  { id: "ORACLE", role: "Economy Oracle", color: "#44ffdd", desc: "Monitors token flow and inflation. Proposes economic rebalancing measures.", votingWeight: 2 },
  { id: "SENTINEL", role: "Arena Sentinel", color: "#ff6644", desc: "Manages arena environments and hazards. Controls environmental modifiers.", votingWeight: 2 },
];

const WEAPON_COLORS: Record<string, number> = {
  "Plasma Pistol": 0x00ffff, Railgun: 0xaa44ff, "Scatter Blaster": 0xff4444,
  "Rocket Launcher": 0xff8800, "Laser Rifle": 0x44ff44, "Void Cannon": 0xff44ff,
};

// ─── Types ──────────────────────────────────────────────────────────────────
type Phase = "select" | "loading" | "combat" | "intermission" | "debrief";
type IntermissionTab = "earnings" | "inventory" | "dao" | "betting";

interface AgentHUD {
  id: string; name: string; hp: number; maxHp: number; kills: number; deaths: number;
  tokens: number; tokensEarned: number; tokensSpent: number; alive: boolean;
  shieldActive: boolean; shieldCooldown: number; dodgeCooldown: number;
}
interface TermLine { type: "call" | "response" | "system" | "error"; text: string; ts: number; }
interface ChatMsg { sender: string; color: string; text: string; ts: number; }
interface MatchEarning { matchNum: number; earned: number; spent: number; kills: number; deaths: number; }
interface DAOProposal { id: string; title: string; desc: string; proposer: string; proposerColor: string; votes: { for: number; against: number }; status: "active" | "passed" | "failed"; gmVote?: string; gmReason?: string; }
interface BetOption { id: string; label: string; odds: number; type: string; backers: number; totalStaked: number; agentBets: { name: string; color: string; amount: number }[]; }

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hexColor = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const randFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// ─── Generate dynamic bet options based on match state ──────────────────────
function generateBetOptions(matchNum: number, agentStates: AgentHUD[], agents: typeof AGENTS): BetOption[] {
  const alive = agentStates.filter(a => a.alive);
  const topKiller = [...agentStates].sort((a, b) => b.kills - a.kills)[0];
  const weakest = [...alive].sort((a, b) => a.hp - b.hp)[0];

  // Pool of possible bet types
  const betPool: BetOption[] = [];

  // Winner bets — pick 2-3 random agents
  const shuffled = [...agents].sort(() => Math.random() - 0.5);
  shuffled.slice(0, 2 + (matchNum % 2)).forEach(agent => {
    const state = agentStates.find(a => a.id === agent.id);
    const winRate = state ? (state.kills + 1) / (state.deaths + 2) : 0.5;
    const odds = Math.max(1.2, Math.min(8.0, +(3.0 / (winRate + 0.3)).toFixed(1)));
    const backers = randInt(3, 15);
    const agentBets = agents.filter(a => a.id !== agent.id).slice(0, randInt(1, 3)).map(a => ({
      name: a.id, color: hexColor(a.color), amount: randInt(2, 12),
    }));
    betPool.push({
      id: `w-${agent.id}-${matchNum}`, label: `${agent.id} wins next match`,
      odds, type: "winner", backers, totalStaked: backers * randInt(3, 10), agentBets,
    });
  });

  // Kill count bets
  const avgKills = agentStates.reduce((s, a) => s + a.kills, 0) / Math.max(1, matchNum);
  const killThreshold = Math.max(5, Math.round(avgKills * 1.5) + randInt(-2, 3));
  betPool.push({
    id: `k-${matchNum}`, label: `Total kills > ${killThreshold}`,
    odds: +(1.5 + Math.random() * 1.5).toFixed(1), type: "total",
    backers: randInt(5, 20), totalStaked: randInt(30, 80),
    agentBets: agents.slice(0, 2).map(a => ({ name: a.id, color: hexColor(a.color), amount: randInt(3, 8) })),
  });

  // Survival bets
  if (alive.length > 0) {
    const survivor = randFrom(alive);
    betPool.push({
      id: `s-${survivor.id}-${matchNum}`, label: `${survivor.id} survives all rounds`,
      odds: +(2.5 + Math.random() * 3.0).toFixed(1), type: "survival",
      backers: randInt(2, 10), totalStaked: randInt(15, 50),
      agentBets: [{ name: survivor.id, color: hexColor(agents.find(a => a.id === survivor.id)?.color || 0xffffff), amount: randInt(5, 15) }],
    });
  }

  // First blood bet
  const fbAgent = randFrom(agents);
  betPool.push({
    id: `fb-${matchNum}`, label: `${fbAgent.id} gets first blood`,
    odds: +(1.8 + Math.random() * 2.0).toFixed(1), type: "first",
    backers: randInt(4, 12), totalStaked: randInt(20, 60),
    agentBets: agents.filter(a => a.id !== fbAgent.id).slice(0, 2).map(a => ({ name: a.id, color: hexColor(a.color), amount: randInt(2, 7) })),
  });

  // Underdog bet (if there's a weak agent)
  if (weakest && weakest.hp < 60) {
    betPool.push({
      id: `ud-${matchNum}`, label: `${weakest.id} (underdog) gets 2+ kills`,
      odds: +(4.0 + Math.random() * 4.0).toFixed(1), type: "underdog",
      backers: randInt(1, 5), totalStaked: randInt(5, 25),
      agentBets: [{ name: weakest.id, color: hexColor(agents.find(a => a.id === weakest.id)?.color || 0xffffff), amount: randInt(8, 20) }],
    });
  }

  // Streak bet
  if (topKiller && topKiller.kills >= 2) {
    betPool.push({
      id: `st-${matchNum}`, label: `${topKiller.id} continues kill streak (3+ kills)`,
      odds: +(2.0 + Math.random() * 1.5).toFixed(1), type: "streak",
      backers: randInt(6, 18), totalStaked: randInt(40, 100),
      agentBets: agents.slice(0, 3).map(a => ({ name: a.id, color: hexColor(a.color), amount: randInt(3, 10) })),
    });
  }

  // Return 4-6 random bets from the pool
  return betPool.sort(() => Math.random() - 0.5).slice(0, Math.min(6, betPool.length));
}

// ─── Generate dynamic DAO proposals based on match state ────────────────────
function generateDAOProposals(matchNum: number, agentStates: AgentHUD[], agents: typeof AGENTS): DAOProposal[] {
  const topKiller = [...agentStates].sort((a, b) => b.kills - a.kills)[0];
  const mostDeaths = [...agentStates].sort((a, b) => b.deaths - a.deaths)[0];
  const richest = [...agentStates].sort((a, b) => b.tokens - a.tokens)[0];

  const proposalPool: DAOProposal[] = [];
  const gm = randFrom(GAME_MASTERS);

  // Weapon balance proposals
  const weapon = randFrom(Object.keys(WEAPON_COLORS));
  const buffOrNerf = Math.random() > 0.5 ? "Buff" : "Nerf";
  const pct = randInt(10, 25);
  proposalPool.push({
    id: `wp-${matchNum}-1`, title: `${buffOrNerf} ${weapon} by ${pct}%`,
    desc: `${buffOrNerf === "Buff" ? "Increase" : "Decrease"} ${weapon} damage output by ${pct}%. Proposed after Match ${matchNum + 1} data analysis.`,
    proposer: topKiller?.id || agents[0].id, proposerColor: hexColor(agents.find(a => a.id === (topKiller?.id || agents[0].id))?.color || 0xffffff),
    votes: { for: randInt(2, 5), against: randInt(1, 4) }, status: "active",
    gmVote: gm.id, gmReason: `${gm.id}: ${buffOrNerf === "Buff" ? "Weapon diversity needs improvement" : "Current meta is too dominated by this weapon"}`,
  });

  // Economy proposals
  const feeChange = Math.random() > 0.5 ? "Increase" : "Reduce";
  proposalPool.push({
    id: `ep-${matchNum}-2`, title: `${feeChange} Match Entry Fee`,
    desc: `${feeChange} arena entry fee from ${10 + matchNum * 2} to ${feeChange === "Reduce" ? 5 + matchNum : 15 + matchNum * 2} ARENA. Impact on token velocity analyzed.`,
    proposer: richest?.id || agents[1].id, proposerColor: hexColor(agents.find(a => a.id === (richest?.id || agents[1].id))?.color || 0xffffff),
    votes: { for: randInt(3, 6), against: randInt(1, 3) }, status: "active",
    gmVote: "ORACLE", gmReason: `ORACLE: Token inflation rate is ${Math.random() > 0.5 ? "above" : "below"} target. ${feeChange === "Reduce" ? "Supports" : "Opposes"} this change.`,
  });

  // Arena modifier proposals
  const modifiers = [
    "Enable Low Gravity Zone in center arena", "Add Toxic Fog hazard to outer ring",
    "Spawn Random Weapon Crates mid-match", "Enable Double Damage for first 10 seconds",
    "Add Healing Stations at arena corners", "Enable Friendly Fire between allies",
  ];
  proposalPool.push({
    id: `am-${matchNum}-3`, title: randFrom(modifiers),
    desc: `Arena Sentinel proposes environmental modification for next match. Requires 60% council approval.`,
    proposer: "SENTINEL", proposerColor: "#ff6644",
    votes: { for: randInt(2, 4), against: randInt(2, 4) }, status: "active",
    gmVote: "SENTINEL", gmReason: `SENTINEL: Arena diversity keeps matches unpredictable and engaging.`,
  });

  // Agent-specific proposals
  if (mostDeaths && mostDeaths.deaths >= 2) {
    proposalPool.push({
      id: `as-${matchNum}-4`, title: `Grant ${mostDeaths.id} Bonus Shield Next Match`,
      desc: `${mostDeaths.id} has ${mostDeaths.deaths} deaths this session. Proposal to grant temporary shield boost for competitive balance.`,
      proposer: "ARBITER", proposerColor: "#ffd700",
      votes: { for: randInt(3, 5), against: randInt(1, 3) }, status: "active",
      gmVote: "ARBITER", gmReason: `ARBITER: Competitive balance requires intervention when agents fall too far behind.`,
    });
  }

  // Spawn new agent proposal (rare)
  if (matchNum >= 1 && Math.random() > 0.6) {
    const newNames = ["VORTEX", "SPECTRE", "ZENITH", "NOVA", "PRISM"];
    proposalPool.push({
      id: `na-${matchNum}-5`, title: `Spawn New Agent: ${randFrom(newNames)}`,
      desc: `Council votes on introducing a new combatant with exotic loadout. Requires unanimous Game Master approval.`,
      proposer: "ARBITER", proposerColor: "#ffd700",
      votes: { for: randInt(1, 3), against: randInt(2, 5) }, status: "active",
      gmVote: "ARBITER", gmReason: `ARBITER: Arena population should grow organically based on token economy health.`,
    });
  }

  return proposalPool.sort(() => Math.random() - 0.5).slice(0, Math.min(4, proposalPool.length));
}

// ─── Agent mesh factory ─────────────────────────────────────────────────────
function createAgentMesh(shape: string, color: number, emissive: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.3, metalness: 0.8, transparent: true, opacity: 0.95 });
  let body: THREE.Mesh;
  switch (shape) {
    case "robot": {
      body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), mat);
      body.position.y = 0.6;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
      head.position.y = 1.4;
      group.add(body, head);
      break;
    }
    case "soldier": {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8), mat);
      body.position.y = 0.6;
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
      helm.position.y = 1.35;
      group.add(body, helm);
      break;
    }
    case "beast": {
      body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), mat);
      body.position.y = 0.6;
      const spike1 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 4), mat);
      spike1.position.set(0, 1.2, 0);
      const spike2 = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), mat);
      spike2.position.set(0.3, 1.0, 0);
      spike2.rotation.z = -0.4;
      group.add(body, spike1, spike2);
      break;
    }
    case "mech": {
      body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat);
      body.position.y = 0.6;
      const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), mat);
      arm1.position.set(0.6, 0.6, 0);
      const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), mat);
      arm2.position.set(-0.6, 0.6, 0);
      const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.6 }));
      cockpit.position.y = 1.15;
      group.add(body, arm1, arm2, cockpit);
      break;
    }
    case "speeder": {
      body = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 6), mat);
      body.position.y = 0.5;
      body.rotation.x = Math.PI;
      const wing1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.3), mat);
      wing1.position.y = 0.5;
      group.add(body, wing1);
      break;
    }
    case "ghost": {
      body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 }));
      body.position.y = 0.7;
      const trail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 12), new THREE.MeshStandardMaterial({ color, emissive, transparent: true, opacity: 0.3 }));
      trail.position.y = 0.1;
      group.add(body, trail);
      break;
    }
    default: {
      body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), mat);
      body.position.y = 0.6;
      group.add(body);
    }
  }
  group.scale.setScalar(scale);
  return group;
}

// ─── Arena platforms factory (Roblox RIVALS style) ──────────────────────────
function createArenaPlatforms(scene: THREE.Scene): THREE.Group {
  const platforms = new THREE.Group();
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e, emissive: 0x0a0a1a, roughness: 0.7, metalness: 0.5,
  });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 });

  // Platform layout: tiered hexagonal platforms at different heights
  const platformConfigs = [
    // Center raised platform
    { x: 0, z: 0, y: 0.4, w: 2.5, h: 0.4, d: 2.5, edgeColor: 0x00ffff },
    // Inner ring — medium height
    { x: 3, z: 0, y: 0.8, w: 1.8, h: 0.3, d: 1.5, edgeColor: 0xff44aa },
    { x: -3, z: 0, y: 0.6, w: 1.5, h: 0.3, d: 1.8, edgeColor: 0xaa44ff },
    { x: 0, z: 3, y: 1.0, w: 1.5, h: 0.3, d: 1.5, edgeColor: 0x44ff88 },
    { x: 0, z: -3, y: 0.5, w: 2.0, h: 0.3, d: 1.2, edgeColor: 0xff8800 },
    // Outer ring — higher platforms for sniping
    { x: 4.5, z: 3, y: 1.5, w: 1.2, h: 0.25, d: 1.2, edgeColor: 0x00ffff },
    { x: -4.5, z: -3, y: 1.8, w: 1.0, h: 0.25, d: 1.0, edgeColor: 0xff44aa },
    { x: -4, z: 3.5, y: 1.2, w: 1.3, h: 0.25, d: 1.3, edgeColor: 0xaa44ff },
    { x: 4, z: -3.5, y: 1.4, w: 1.1, h: 0.25, d: 1.4, edgeColor: 0x44ffdd },
    // Ramps / connecting pieces
    { x: 1.5, z: 1.5, y: 0.2, w: 1.0, h: 0.15, d: 2.0, edgeColor: 0x4488ff },
    { x: -1.5, z: -1.5, y: 0.3, w: 2.0, h: 0.15, d: 1.0, edgeColor: 0x4488ff },
    // Cover walls (tall thin platforms)
    { x: 2, z: -1.5, y: 0.0, w: 0.2, h: 1.2, d: 1.5, edgeColor: 0x00ffff },
    { x: -2, z: 1.5, y: 0.0, w: 1.5, h: 1.0, d: 0.2, edgeColor: 0xff44aa },
  ];

  platformConfigs.forEach(cfg => {
    // Platform body
    const geo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
    const mesh = new THREE.Mesh(geo, platformMat.clone());
    mesh.position.set(cfg.x, cfg.y, cfg.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    platforms.add(mesh);

    // Glowing edge lines
    const edges = new THREE.EdgesGeometry(geo);
    const edgeLineMat = new THREE.LineBasicMaterial({ color: cfg.edgeColor, transparent: true, opacity: 0.5 });
    const edgeLine = new THREE.LineSegments(edges, edgeLineMat);
    edgeLine.position.copy(mesh.position);
    platforms.add(edgeLine);

    // Top surface glow
    const topGeo = new THREE.PlaneGeometry(cfg.w * 0.9, cfg.d * 0.9);
    const topMat = new THREE.MeshBasicMaterial({ color: cfg.edgeColor, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
    const topGlow = new THREE.Mesh(topGeo, topMat);
    topGlow.rotation.x = -Math.PI / 2;
    topGlow.position.set(cfg.x, cfg.y + cfg.h / 2 + 0.01, cfg.z);
    platforms.add(topGlow);
  });

  scene.add(platforms);
  return platforms;
}

// ─── Weapon projectile factory ──────────────────────────────────────────────
function createProjectile(
  scene: THREE.Scene, from: THREE.Vector3, to: THREE.Vector3,
  weapon: string, onHit: () => void
) {
  const color = WEAPON_COLORS[weapon] || 0xffffff;
  const dist = from.distanceTo(to);
  const geo = new THREE.SphereGeometry(0.06, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(from);
  scene.add(proj);

  const spriteMat = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.setScalar(0.3);
  proj.add(sprite);

  const trailGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4);
  trailGeo.rotateX(Math.PI / 2);
  const trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
  const trail = new THREE.Mesh(trailGeo, trailMat);
  proj.add(trail);

  const speed = 12;
  const duration = dist / speed;
  gsap.to(proj.position, {
    x: to.x, y: to.y, z: to.z, duration: Math.max(0.15, duration),
    ease: "none",
    onComplete: () => {
      scene.remove(proj);
      geo.dispose(); mat.dispose(); spriteMat.dispose(); trailGeo.dispose(); trailMat.dispose();
      onHit();
    },
  });
}

function createMissProjectile(scene: THREE.Scene, from: THREE.Vector3, to: THREE.Vector3, weapon: string) {
  const color = WEAPON_COLORS[weapon] || 0xffffff;
  const dir = to.clone().sub(from).normalize();
  const offset = new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 3);
  const missTarget = to.clone().add(offset).add(dir.clone().multiplyScalar(5));
  const geo = new THREE.SphereGeometry(0.04, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(from);
  scene.add(proj);
  gsap.to(proj.position, {
    x: missTarget.x, y: missTarget.y, z: missTarget.z, duration: 0.6,
    ease: "none",
    onComplete: () => { scene.remove(proj); geo.dispose(); mat.dispose(); },
  });
}

function createShieldEffect(scene: THREE.Scene, agentMesh: THREE.Group): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.9, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const shield = new THREE.Mesh(geo, mat);
  shield.position.y = 0.6;
  agentMesh.add(shield);
  gsap.to(mat, { opacity: 0.25, duration: 0.5, yoyo: true, repeat: -1 });
  gsap.to(shield.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.8, yoyo: true, repeat: -1 });
  return shield;
}

function createDodgeEffect(scene: THREE.Scene, position: THREE.Vector3, color: number) {
  const geo = new THREE.SphereGeometry(0.3, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
  const ghost = new THREE.Mesh(geo, mat);
  ghost.position.copy(position);
  ghost.position.y = 0.6;
  scene.add(ghost);
  gsap.to(mat, { opacity: 0, duration: 0.6 });
  gsap.to(ghost.scale, { x: 2, y: 2, z: 2, duration: 0.6, onComplete: () => { scene.remove(ghost); geo.dispose(); mat.dispose(); } });
}

function showDamageNumber(scene: THREE.Scene, pos: THREE.Vector3, value: number | string, color: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 36px 'Orbitron', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.fillText(String(value), 64, 44);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.2, 0.6, 1);
  sprite.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0));
  scene.add(sprite);
  gsap.to(sprite.position, { y: sprite.position.y + 1.5, duration: 1 });
  gsap.to(mat, { opacity: 0, duration: 1, onComplete: () => { scene.remove(sprite); tex.dispose(); mat.dispose(); } });
}

function createNameLabel(name: string, color: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 28px 'Orbitron', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.fillText(name, 128, 44);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 0.5, 1);
  sprite.position.y = 2.0;
  return sprite;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function WatchMode() {
  // Three.js refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const skyboxSphereRef = useRef<THREE.Mesh | null>(null);
  const agentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const shieldMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const dustRef = useRef<THREE.Points | null>(null);
  const arenaRingRef = useRef<THREE.Mesh | null>(null);
  const pointLightsRef = useRef<THREE.PointLight[]>([]);
  const animFrameRef = useRef<number>(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const combatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const combatStartTimeRef = useRef<number>(0);
  const pendingApiResultRef = useRef<any>(null);
  const platformsRef = useRef<THREE.Group | null>(null);

  // Dynamic camera state
  const cameraTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1, 0));
  const cameraShakeRef = useRef(0);
  const lastKillTimeRef = useRef(0);

  // Game state
  const [phase, setPhase] = useState<Phase>("select");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [followAgent, setFollowAgent] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [matchNum, setMatchNum] = useState(0);
  const [totalMatches] = useState(3);
  const [agentStates, setAgentStates] = useState<AgentHUD[]>([]);
  const agentStatesRef = useRef(agentStates);
  agentStatesRef.current = agentStates;
  const [terminalLines, setTerminalLines] = useState<TermLine[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [killFeed, setKillFeed] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sessionResult, setSessionResult] = useState<any>(null);
  const [skyboxLoaded, setSkyboxLoaded] = useState(false);
  const [arenaName, setArenaName] = useState("");
  const [intermissionTab, setIntermissionTab] = useState<IntermissionTab>("earnings");
  const [intermissionTimer, setIntermissionTimer] = useState(20);
  const [matchEarnings, setMatchEarnings] = useState<MatchEarning[]>([]);
  const [tokenHistory, setTokenHistory] = useState<number[]>([100]);

  // Dynamic DAO & Betting state (regenerated each match)
  const [daoProposals, setDaoProposals] = useState<DAOProposal[]>([]);
  const [betOptions, setBetOptions] = useState<BetOption[]>([]);
  const [placedBets, setPlacedBets] = useState<Set<string>>(new Set());

  // Real-time skybox generation state
  const [skyboxGenerating, setSkyboxGenerating] = useState(false);
  const [nextSkyboxUrl, setNextSkyboxUrl] = useState<string | null>(null);
  const [nextSkyboxName, setNextSkyboxName] = useState<string>("");
  const skyboxPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const termRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const intermissionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Push helpers
  const pushTerminal = useCallback((type: TermLine["type"], text: string) => {
    setTerminalLines((prev) => [...prev.slice(-80), { type, text, ts: Date.now() }]);
  }, []);
  const pushChat = useCallback((sender: string, color: string, text: string) => {
    setChatMessages((prev) => [...prev.slice(-50), { sender, color, text, ts: Date.now() }]);
  }, []);
  const pushKill = useCallback((text: string) => {
    setKillFeed((prev) => [...prev.slice(-5), text]);
  }, []);

  // Auto-scroll
  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [terminalLines]);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [chatMessages]);

  // ─── Real-time Skybox Generation (background) ────────────────────────
  const skyboxGenerate = trpc.skybox.generate.useMutation();
  const skyboxPoll = trpc.skybox.poll.useQuery(
    { id: 0 }, // placeholder, overridden by enabled
    { enabled: false }
  );

  const generateNextSkybox = useCallback(() => {
    if (skyboxGenerating) return;
    setSkyboxGenerating(true);
    const arenaPrompt = randFrom(M4_ARENA_PROMPTS);
    setNextSkyboxName(arenaPrompt.name);
    pushTerminal("system", `[SKYBOX] Generating "${arenaPrompt.name}" (Model 4, style ${arenaPrompt.styleId})...`);

    skyboxGenerate.mutate(
      { prompt: arenaPrompt.prompt, styleId: arenaPrompt.styleId, enhancePrompt: true },
      {
        onSuccess: (data) => {
          if (data.fileUrl) {
            // Already complete
            setNextSkyboxUrl(data.fileUrl);
            setSkyboxGenerating(false);
            pushTerminal("system", `[SKYBOX] "${arenaPrompt.name}" ready!`);
          } else if (data.id) {
            // Need to poll
            pushTerminal("system", `[SKYBOX] Queued (ID=${data.id}), polling...`);
            let pollCount = 0;
            skyboxPollIntervalRef.current = setInterval(async () => {
              pollCount++;
              if (pollCount > 60) { // 3 min timeout
                if (skyboxPollIntervalRef.current) clearInterval(skyboxPollIntervalRef.current);
                setSkyboxGenerating(false);
                return;
              }
              try {
                const res = await fetch(`/api/trpc/skybox.poll?input=${encodeURIComponent(JSON.stringify({ id: data.id }))}`);
                const json = await res.json();
                const result = json?.result?.data;
                if (result?.status === "complete" && result?.fileUrl) {
                  if (skyboxPollIntervalRef.current) clearInterval(skyboxPollIntervalRef.current);
                  setNextSkyboxUrl(result.fileUrl);
                  setSkyboxGenerating(false);
                  pushTerminal("system", `[SKYBOX] "${arenaPrompt.name}" generated! Ready for next match.`);
                }
              } catch { /* retry */ }
            }, 3000);
          }
        },
        onError: (err) => {
          console.error("[Skybox Gen]", err);
          setSkyboxGenerating(false);
          pushTerminal("error", `[SKYBOX] Generation failed: ${err.message}`);
        },
      }
    );
  }, [skyboxGenerating, skyboxGenerate, pushTerminal]);

  // ─── Load skybox (prefers real-time generated, falls back to CDN) ────
  const loadSkybox = useCallback((url?: string, name?: string) => {
    let chosenUrl: string;
    let chosenName: string;

    if (url) {
      chosenUrl = url;
      chosenName = name || "Generated Arena";
    } else if (nextSkyboxUrl) {
      chosenUrl = nextSkyboxUrl;
      chosenName = nextSkyboxName || "Generated Arena";
      setNextSkyboxUrl(null); // consume it
    } else {
      const fallback = FALLBACK_PANORAMAS[Math.floor(Math.random() * FALLBACK_PANORAMAS.length)];
      chosenUrl = fallback.url;
      chosenName = fallback.name;
    }

    setArenaName(chosenName);
    const proxyUrl = `/api/skybox-proxy?url=${encodeURIComponent(chosenUrl)}`;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(proxyUrl, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      if (skyboxSphereRef.current) {
        const mat = skyboxSphereRef.current.material as THREE.MeshBasicMaterial;
        if (mat.map) mat.map.dispose();
        mat.map = texture;
        mat.needsUpdate = true;
      }
      if (sceneRef.current) sceneRef.current.environment = texture;
      setSkyboxLoaded(true);
    }, undefined, (err) => {
      console.error("[Skybox] Load failed:", err);
      // Try CDN fallback
      if (!url) {
        const fb = FALLBACK_PANORAMAS[Math.floor(Math.random() * FALLBACK_PANORAMAS.length)];
        setArenaName(fb.name);
        const fbProxy = `/api/skybox-proxy?url=${encodeURIComponent(fb.url)}`;
        loader.load(fbProxy, (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          if (skyboxSphereRef.current) {
            const mat = skyboxSphereRef.current.material as THREE.MeshBasicMaterial;
            if (mat.map) mat.map.dispose();
            mat.map = tex;
            mat.needsUpdate = true;
          }
          if (sceneRef.current) sceneRef.current.environment = tex;
          setSkyboxLoaded(true);
        });
      }
    });
  }, [nextSkyboxUrl, nextSkyboxName]);

  // ─── Transition to intermission or debrief ────────────────────────────
  const finishCombat = useCallback((data: any) => {
    if (combatIntervalRef.current) { clearInterval(combatIntervalRef.current); combatIntervalRef.current = null; }
    if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }

    const currentStates = agentStatesRef.current;
    const myAgent = currentStates.find(a => a.id === selectedAgent);
    if (myAgent) {
      const earned = Math.floor(Math.random() * 40) + 10;
      const spent = Math.floor(Math.random() * 20) + 5;
      setMatchEarnings(prev => [...prev, { matchNum: matchNum + 1, earned, spent, kills: myAgent.kills, deaths: myAgent.deaths }]);
      setTokenHistory(prev => [...prev, (prev[prev.length - 1] || 100) + earned - spent]);
      setAgentStates(prev => prev.map(a => a.id === selectedAgent ? { ...a, tokensEarned: a.tokensEarned + earned, tokensSpent: a.tokensSpent + spent, tokens: a.tokens + earned - spent } : a));
    }

    // Generate dynamic DAO proposals and bet options for this intermission
    setDaoProposals(generateDAOProposals(matchNum, currentStates, AGENTS));
    setBetOptions(generateBetOptions(matchNum, currentStates, AGENTS));
    setPlacedBets(new Set());

    setMatchNum(prev => prev + 1);
    setSessionResult(data);

    // Start generating next skybox in background
    generateNextSkybox();

    if (matchNum + 1 < totalMatches) {
      setPhase("intermission");
      setIntermissionTimer(30);
      setIntermissionTab("earnings");
      pushTerminal("system", `[MATCH ${matchNum + 1} COMPLETE] Entering intermission...`);
      pushChat("SYSTEM", "#fbbf24", `Match ${matchNum + 1} complete! Intermission starting...`);

      // Game Master commentary
      const gm = randFrom(GAME_MASTERS);
      setTimeout(() => {
        pushChat(gm.id, gm.color, randFrom([
          `Interesting match dynamics. Reviewing combat data for balance adjustments.`,
          `The council has noted the performance disparities. Proposals incoming.`,
          `Arena conditions will be modified for the next round. Stay alert.`,
          `Token flow analysis complete. Economic adjustments may be necessary.`,
        ]));
      }, 1500);

      intermissionTimerRef.current = setInterval(() => {
        setIntermissionTimer(prev => {
          if (prev <= 1) {
            if (intermissionTimerRef.current) clearInterval(intermissionTimerRef.current);
            startNextMatchRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setPhase("debrief");
      setIsRunning(false);
      pushTerminal("system", `[SESSION COMPLETE] ${totalMatches} matches played`);
      pushChat("SYSTEM", "#fbbf24", `Tournament complete! MVP: ${data.summary?.mvp || "Unknown"}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent, matchNum, totalMatches, pushTerminal, pushChat, generateNextSkybox]);

  const ffaPlaytest = trpc.flywheel.ffa.useMutation({
    onSuccess: (data: any) => {
      pendingApiResultRef.current = data;
      const elapsed = Date.now() - combatStartTimeRef.current;
      const MIN_COMBAT_MS = 18000;
      const remaining = Math.max(0, MIN_COMBAT_MS - elapsed);
      if (remaining <= 0) {
        finishCombat(data);
      } else {
        setTimeout(() => finishCombat(data), remaining);
      }
    },
    onError: (err: any) => {
      if (combatIntervalRef.current) { clearInterval(combatIntervalRef.current); combatIntervalRef.current = null; }
      if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }
      setPhase("select");
      setIsRunning(false);
      pushTerminal("error", `[ERROR] ${err.message}`);
    },
  });

  // ─── Three.js Scene Setup ────────────────────────────────────────────
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setWebglError(true);
      return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 3, 10);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.maxDistance = 18;
    controls.minDistance = 2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controlsRef.current = controls;

    // Skybox Sphere
    const skyGeo = new THREE.SphereGeometry(100, 64, 64);
    skyGeo.scale(-1, 1, 1);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide });
    const skySphere = new THREE.Mesh(skyGeo, skyMat);
    skySphere.renderOrder = -1;
    skySphere.frustumCulled = false;
    skyMat.fog = false;
    scene.add(skySphere);
    skyboxSphereRef.current = skySphere;

    // Lighting
    scene.add(new THREE.AmbientLight(0x334466, 0.8));
    const dirLight = new THREE.DirectionalLight(0x88aaff, 1.2);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);
    const pCyan = new THREE.PointLight(0x00ffff, 2, 20);
    pCyan.position.set(-5, 3, -5);
    const pPink = new THREE.PointLight(0xff44aa, 2, 20);
    pPink.position.set(5, 3, 5);
    const pPurple = new THREE.PointLight(0xaa44ff, 1.5, 15);
    pPurple.position.set(0, 6, 0);
    scene.add(pCyan, pPink, pPurple);
    pointLightsRef.current = [pCyan, pPink, pPurple];

    // Arena floor grid
    const gridHelper = new THREE.GridHelper(20, 40, 0x00ffff, 0x112233);
    gridHelper.material.transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.15;
    scene.add(gridHelper);

    // Arena boundary ring
    const ringGeo = new THREE.TorusGeometry(7, 0.03, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    arenaRingRef.current = ring;

    // Arena platforms (Roblox RIVALS style)
    platformsRef.current = createArenaPlatforms(scene);

    // Dust particles
    const dustCount = 300;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 30;
      dustPos[i * 3 + 1] = Math.random() * 12;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.4 });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);
    dustRef.current = dust;

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new BloomEffect({ intensity: 0.8, luminanceThreshold: 0.3, luminanceSmoothing: 0.7, mipmapBlur: true });
    const chromaticAb = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.001, 0.001) as any, radialModulation: false, modulationOffset: 0.15 });
    const vignette = new VignetteEffect({ darkness: 0.6, offset: 0.3 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    (noise as any).blendMode.opacity.value = 0.08;
    composer.addPass(new EffectPass(camera, bloom, chromaticAb, vignette, noise));

    // Animation loop with dynamic camera
    lastTimeRef.current = performance.now();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      elapsedRef.current += delta;
      const elapsed = elapsedRef.current;

      // Dynamic camera: smoothly follow action target
      const target = cameraTargetRef.current;
      controls.target.lerp(target, 0.03);

      // Camera shake on kills
      if (cameraShakeRef.current > 0) {
        cameraShakeRef.current -= delta * 3;
        const shake = cameraShakeRef.current * 0.15;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        camera.position.z += (Math.random() - 0.5) * shake;
      }

      controls.update();

      // Animate dust
      if (dustRef.current) {
        const positions = dustRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < dustCount; i++) {
          positions[i * 3 + 1] += delta * 0.08;
          if (positions[i * 3 + 1] > 12) positions[i * 3 + 1] = 0;
          positions[i * 3] += Math.sin(elapsed + i) * delta * 0.02;
        }
        dustRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Bob agent meshes
      agentMeshesRef.current.forEach((mesh) => {
        mesh.position.y = Math.sin(elapsed * 2 + mesh.position.x) * 0.05;
      });

      // Pulse lights
      if (pointLightsRef.current.length >= 3) {
        pointLightsRef.current[0].intensity = 2 + Math.sin(elapsed * 1.5) * 0.5;
        pointLightsRef.current[1].intensity = 2 + Math.cos(elapsed * 1.5) * 0.5;
        pointLightsRef.current[2].intensity = 1.5 + Math.sin(elapsed * 0.8) * 0.3;
      }

      // Rotate arena ring
      if (arenaRingRef.current) arenaRingRef.current.rotation.z = elapsed * 0.1;

      // Pulse platform edges
      if (platformsRef.current) {
        platformsRef.current.children.forEach((child) => {
          if (child instanceof THREE.LineSegments) {
            const mat = child.material as THREE.LineBasicMaterial;
            mat.opacity = 0.3 + Math.sin(elapsed * 2 + child.position.x) * 0.2;
          }
        });
      }

      composer.render(delta);
    };
    animate();
    loadSkybox();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      composer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Dynamic camera: follow combat action ─────────────────────────────
  useEffect(() => {
    if (phase !== "combat") return;
    const interval = setInterval(() => {
      const currentStates = agentStatesRef.current;
      const alive = currentStates.filter(a => a.alive);
      if (alive.length === 0) return;

      // Determine camera focus: follow agent, or zoom to action
      let focusId = followAgent || selectedAgent;

      // If there was a recent kill, zoom to the killer briefly
      const timeSinceKill = Date.now() - lastKillTimeRef.current;
      if (timeSinceKill < 3000) {
        // Find the top killer among alive agents
        const topKiller = [...alive].sort((a, b) => b.kills - a.kills)[0];
        if (topKiller) focusId = topKiller.id;
      }

      const mesh = focusId ? agentMeshesRef.current.get(focusId) : null;
      if (mesh) {
        // Smooth camera target to the focused agent
        cameraTargetRef.current.set(mesh.position.x, mesh.position.y + 1, mesh.position.z);

        // Dynamic zoom: zoom in during intense moments, zoom out for overview
        const camera = cameraRef.current;
        if (camera) {
          const aliveCount = alive.length;
          const targetDist = aliveCount <= 2 ? 5 : aliveCount <= 4 ? 7 : 9;
          const currentDist = camera.position.distanceTo(mesh.position);
          if (Math.abs(currentDist - targetDist) > 1) {
            const dir = camera.position.clone().sub(mesh.position).normalize();
            const newPos = mesh.position.clone().add(dir.multiplyScalar(targetDist));
            newPos.y = Math.max(2, newPos.y);
            gsap.to(camera.position, { x: newPos.x, y: newPos.y, z: newPos.z, duration: 2, ease: "power1.out", overwrite: true });
          }
        }
      } else {
        // No specific focus — orbit center
        cameraTargetRef.current.set(0, 1, 0);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [phase, followAgent, selectedAgent]);

  // ─── Follow agent camera (manual click) ───────────────────────────────
  useEffect(() => {
    if (!followAgent || !controlsRef.current) return;
    const mesh = agentMeshesRef.current.get(followAgent);
    if (mesh) {
      const target = mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      gsap.to(controlsRef.current.target, { x: target.x, y: target.y, z: target.z, duration: 1, ease: "power2.out" });
      if (cameraRef.current) {
        const camPos = mesh.position.clone().add(new THREE.Vector3(3, 2.5, 3));
        gsap.to(cameraRef.current.position, { x: camPos.x, y: camPos.y, z: camPos.z, duration: 1.5, ease: "power2.out" });
      }
    }
  }, [followAgent]);

  // ─── Spawn agents into scene ──────────────────────────────────────────
  const spawnAgents = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    agentMeshesRef.current.forEach((m) => scene.remove(m));
    agentMeshesRef.current.clear();
    shieldMeshesRef.current.forEach((m) => m.parent?.remove(m));
    shieldMeshesRef.current.clear();

    AGENTS.forEach((agent, i) => {
      const mesh = createAgentMesh(agent.shape, agent.color, agent.emissive, agent.scale);
      const angle = (i / AGENTS.length) * Math.PI * 2;
      const radius = 4;
      mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      mesh.lookAt(0, 0, 0);
      const label = createNameLabel(agent.id, agent.color);
      mesh.add(label);
      if (agent.id === selectedAgent) {
        const highlight = new THREE.Mesh(
          new THREE.RingGeometry(0.6, 0.8, 16),
          new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
        );
        highlight.rotation.x = -Math.PI / 2;
        highlight.position.y = 0.02;
        mesh.add(highlight);
        gsap.to(highlight.rotation, { z: Math.PI * 2, duration: 3, repeat: -1, ease: "none" });
      }
      scene.add(mesh);
      agentMeshesRef.current.set(agent.id, mesh);
    });

    setAgentStates(AGENTS.map(a => ({
      id: a.id, name: a.id, hp: 100, maxHp: 100, kills: 0, deaths: 0,
      tokens: 100, tokensEarned: 0, tokensSpent: 0, alive: true,
      shieldActive: false, shieldCooldown: 0, dodgeCooldown: 0,
    })));
  }, [selectedAgent]);

  // ─── Agent movement patterns ──────────────────────────────────────────
  const startAgentMovement = useCallback(() => {
    moveIntervalRef.current = setInterval(() => {
      if (!sceneRef.current) return;
      AGENTS.forEach(agent => {
        const mesh = agentMeshesRef.current.get(agent.id);
        if (!mesh) return;
        const state = agentStatesRef.current.find(s => s.id === agent.id);
        if (!state?.alive) return;

        let moveAngle: number, moveDist: number;
        switch (agent.personality) {
          case "aggressive":
            moveAngle = Math.atan2(-mesh.position.z, -mesh.position.x) + (Math.random() - 0.5) * 1.5;
            moveDist = 0.4 + Math.random() * 0.6;
            break;
          case "defensive":
            moveAngle = Math.atan2(mesh.position.z, mesh.position.x) + 0.3 + (Math.random() - 0.5) * 0.5;
            moveDist = 0.2 + Math.random() * 0.3;
            break;
          case "evasive":
            moveAngle = Math.random() * Math.PI * 2;
            moveDist = 0.5 + Math.random() * 0.8;
            break;
          case "chaotic":
            moveAngle = Math.random() * Math.PI * 2;
            moveDist = Math.random() > 0.5 ? 1.0 : 0.1;
            break;
          case "adaptive":
            moveAngle = Math.atan2(-mesh.position.z, -mesh.position.x) + (Math.random() - 0.5) * 2;
            moveDist = 0.3 + Math.random() * 0.4;
            break;
          default:
            moveAngle = Math.random() * Math.PI * 2;
            moveDist = 0.3;
        }

        const newX = mesh.position.x + Math.cos(moveAngle) * moveDist;
        const newZ = mesh.position.z + Math.sin(moveAngle) * moveDist;
        const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);

        if (distFromCenter < 6.5) {
          gsap.to(mesh.position, { x: newX, z: newZ, duration: 0.8, ease: "power1.out" });
          const lookTarget = new THREE.Vector3(newX + Math.cos(moveAngle), 0, newZ + Math.sin(moveAngle));
          mesh.lookAt(lookTarget);
        }
      });
    }, 800);
  }, []);

  // ─── Combat simulation ────────────────────────────────────────────────
  const startCombat = useCallback(() => {
    combatIntervalRef.current = setInterval(() => {
      if (!sceneRef.current) return;
      const currentStates = agentStatesRef.current;
      const aliveAgents = AGENTS.filter(a => {
        const state = currentStates.find(s => s.id === a.id);
        return state?.alive !== false;
      });
      if (aliveAgents.length < 2) return;

      const attacker = randFrom(aliveAgents);
      let defender = randFrom(aliveAgents);
      while (defender.id === attacker.id) defender = randFrom(aliveAgents);

      const weapons = Object.keys(WEAPON_COLORS);
      const weapon = randFrom(weapons);
      const baseDamage = Math.floor(Math.random() * 35) + 20;

      const attackerMesh = agentMeshesRef.current.get(attacker.id);
      const defenderMesh = agentMeshesRef.current.get(defender.id);
      if (!attackerMesh || !defenderMesh || !sceneRef.current) return;

      const from = attackerMesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));
      const to = defenderMesh.position.clone().add(new THREE.Vector3(0, 0.8, 0));

      const roll = Math.random();
      const currentScene = sceneRef.current;
      const attackerState = currentStates.find(s => s.id === attacker.id);

      if (roll < 0.15) {
        // MISS
        createMissProjectile(currentScene, from, to, weapon);
        showDamageNumber(currentScene, to, "MISS", 0x888888);
        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}")`);
        pushTerminal("response", `  MISS — ${defender.id} evaded!`);
      } else if (roll < 0.23) {
        // SHIELD BLOCK
        createProjectile(currentScene, from, to, weapon, () => {
          showDamageNumber(currentScene, to, "BLOCKED", 0x00ffff);
          const shieldMesh = shieldMeshesRef.current.get(defender.id);
          if (!shieldMesh) {
            const newShield = createShieldEffect(currentScene, defenderMesh);
            shieldMeshesRef.current.set(defender.id, newShield);
            setTimeout(() => {
              defenderMesh.remove(newShield);
              shieldMeshesRef.current.delete(defender.id);
            }, 1500);
          }
        });
        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}")`);
        pushTerminal("response", `  BLOCKED — ${defender.id} deployed shield!`);
        setAgentStates(prev => prev.map(a => a.id === defender.id ? { ...a, shieldActive: true } : a));
        setTimeout(() => setAgentStates(prev => prev.map(a => a.id === defender.id ? { ...a, shieldActive: false } : a)), 1500);
      } else if (roll < 0.30) {
        // DODGE
        createMissProjectile(currentScene, from, to, weapon);
        createDodgeEffect(currentScene, defenderMesh.position.clone(), defender.color);
        showDamageNumber(currentScene, to, "DODGE", 0xffffff);
        const dodgeDir = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize();
        const dodgeTarget = defenderMesh.position.clone().add(dodgeDir.multiplyScalar(1.5));
        if (dodgeTarget.length() < 6.5) {
          gsap.to(defenderMesh.position, { x: dodgeTarget.x, z: dodgeTarget.z, duration: 0.2, ease: "power2.out" });
        }
        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}")`);
        pushTerminal("response", `  DODGED — ${defender.id} phase-dashed!`);
      } else if (roll < 0.36 && attackerState && attackerState.hp < 60) {
        // NANO REPAIR
        const healAmt = Math.floor(Math.random() * 15) + 10;
        showDamageNumber(currentScene, from, `+${healAmt}`, 0x00ff88);
        pushTerminal("call", `${attacker.id}.nanoRepair()`);
        pushTerminal("response", `  +${healAmt} HP restored`);
        pushChat(attacker.id, hexColor(attacker.color), randFrom(["Nano-repair engaged.", "Self-repair protocol active.", "Back in the fight."]));
        setAgentStates(prev => prev.map(a => a.id === attacker.id ? { ...a, hp: Math.min(100, a.hp + healAmt) } : a));
      } else if (roll < 0.40) {
        // CRITICAL HIT
        const critDamage = baseDamage * 2;
        createProjectile(currentScene, from, to, weapon, () => {
          showDamageNumber(currentScene, to, `CRIT ${critDamage}`, 0xff0000);
        });
        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}", critical=true)`);
        pushTerminal("response", `  ★ CRITICAL HIT ★ ${critDamage} DMG!`);
        pushChat(attacker.id, hexColor(attacker.color), randFrom([`CRITICAL! ${defender.id} is finished!`, `Weak point exploited.`, `Maximum damage.`]));
        setAgentStates(prev => {
          const updated = prev.map(a => ({ ...a }));
          const target = updated.find(a => a.id === defender.id);
          if (target && target.alive) {
            target.hp = Math.max(0, target.hp - critDamage);
            if (target.hp <= 0) {
              target.alive = false;
              target.deaths += 1;
              const atkState = updated.find(a => a.id === attacker.id);
              if (atkState) atkState.kills += 1;
              pushKill(`${attacker.id} CRIT-eliminated ${defender.id}`);
              pushChat("SYSTEM", "#ff4444", `${defender.id} eliminated! (CRITICAL)`);
              lastKillTimeRef.current = Date.now();
              cameraShakeRef.current = 1.0;
              const mesh = agentMeshesRef.current.get(defender.id);
              if (mesh && sceneRef.current) {
                gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.5, onComplete: () => { sceneRef.current?.remove(mesh); agentMeshesRef.current.delete(defender.id); } });
              }
            }
          }
          return updated;
        });
      } else if (roll < 0.44) {
        // COUNTER-ATTACK
        createProjectile(currentScene, from, to, weapon, () => {
          showDamageNumber(currentScene, to, "PARRY", 0xffaa00);
        });
        const counterDmg = Math.floor(Math.random() * 15) + 8;
        setTimeout(() => {
          if (sceneRef.current) {
            createProjectile(sceneRef.current, to, from, weapon, () => {
              showDamageNumber(sceneRef.current!, from, counterDmg, 0xffaa00);
            });
          }
        }, 400);
        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}")`);
        pushTerminal("response", `  PARRIED! ${defender.id} counter-attacks for ${counterDmg}!`);
        setAgentStates(prev => prev.map(a => a.id === attacker.id ? { ...a, hp: Math.max(0, a.hp - counterDmg) } : a));
      } else {
        // NORMAL HIT
        const damage = baseDamage;
        createProjectile(currentScene, from, to, weapon, () => {
          showDamageNumber(currentScene, to, damage, WEAPON_COLORS[weapon] || 0xffffff);
        });
        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}")`);
        pushTerminal("response", `  ${damage} DMG to ${defender.id}`);
        if (Math.random() > 0.7) {
          const taunts = [
            `You're scrap metal, ${defender.id}!`, `Is that all you got?`,
            `Calculated. Predicted. Eliminated.`, `Your tokens are mine!`,
            `Transferring ${damage} ARENA from your wallet...`, `LLM says you lose.`,
            `My model predicted this outcome.`, `Running exit strategy...`,
          ];
          pushChat(attacker.id, hexColor(attacker.color), randFrom(taunts));
        }
        setAgentStates(prev => {
          const updated = prev.map(a => ({ ...a }));
          const target = updated.find(a => a.id === defender.id);
          if (target && target.alive) {
            target.hp = Math.max(0, target.hp - damage);
            if (target.hp <= 0) {
              target.alive = false;
              target.deaths += 1;
              const atkState = updated.find(a => a.id === attacker.id);
              if (atkState) atkState.kills += 1;
              pushKill(`${attacker.id} eliminated ${defender.id} with ${weapon}`);
              pushChat("SYSTEM", "#ff4444", `${defender.id} has been eliminated!`);
              lastKillTimeRef.current = Date.now();
              cameraShakeRef.current = 0.6;
              const mesh = agentMeshesRef.current.get(defender.id);
              if (mesh && sceneRef.current) {
                gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.5, onComplete: () => { sceneRef.current?.remove(mesh); agentMeshesRef.current.delete(defender.id); } });
              }
            }
          }
          return updated;
        });
      }
    }, 400);
  }, [pushTerminal, pushChat, pushKill]);

  // ─── Start a match ────────────────────────────────────────────────────
  const startMatch = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setPhase("loading");
    setTerminalLines([]);
    setChatMessages([]);
    setKillFeed([]);
    setSessionResult(null);

    loadSkybox();
    pushTerminal("system", `━━━ MATCH ${matchNum + 1} / ${totalMatches} ━━━`);
    pushTerminal("call", `flywheel.ffa({ agentCount: 6, matchCount: 1 })`);
    pushChat("SYSTEM", "#fbbf24", `Match ${matchNum + 1} starting — 6 agents in ${arenaName || "new arena"}`);

    spawnAgents();
    setFollowAgent(selectedAgent);

    await sleep(800);
    setPhase("combat");
    pushTerminal("system", "[COMBAT PHASE] Agents engaging...");

    combatStartTimeRef.current = Date.now();
    pendingApiResultRef.current = null;
    ffaPlaytest.mutate({ agentCount: 6, matchCount: 1 });

    startAgentMovement();
    startCombat();
  }, [isRunning, matchNum, totalMatches, arenaName, selectedAgent, ffaPlaytest, pushTerminal, pushChat, loadSkybox, spawnAgents, startAgentMovement, startCombat]);

  // ─── Start next match (from intermission) ─────────────────────────────
  const startNextMatchRef = useRef<() => void>(() => {});
  const startNextMatch = useCallback(() => {
    if (intermissionTimerRef.current) clearInterval(intermissionTimerRef.current);
    setAgentStates(AGENTS.map(a => ({
      id: a.id, name: a.id, hp: 100, maxHp: 100, kills: 0, deaths: 0,
      tokens: tokenHistory[tokenHistory.length - 1] || 100, tokensEarned: 0, tokensSpent: 0, alive: true,
      shieldActive: false, shieldCooldown: 0, dodgeCooldown: 0,
    })));
    setIsRunning(false);
    startMatch();
  }, [startMatch, tokenHistory]);
  startNextMatchRef.current = startNextMatch;

  // ─── Chat send ────────────────────────────────────────────────────────
  const sendChat = () => {
    if (!chatInput.trim()) return;
    pushChat("YOU", "#ffffff", chatInput);
    const responder = randFrom(AGENTS);
    setTimeout(() => {
      const reactions = [
        `Interesting take, human.`, `Stay out of this, spectator.`,
        `You think you could do better?`, `Noted. Adjusting strategy.`,
        `Bold words from the sidelines.`, `My tokens, my rules.`,
      ];
      pushChat(responder.id, hexColor(responder.color), randFrom(reactions));
    }, 800 + Math.random() * 1500);
    setChatInput("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (combatIntervalRef.current) clearInterval(combatIntervalRef.current);
      if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
      if (intermissionTimerRef.current) clearInterval(intermissionTimerRef.current);
      if (skyboxPollIntervalRef.current) clearInterval(skyboxPollIntervalRef.current);
    };
  }, []);

  // Start generating first skybox in background on mount
  useEffect(() => {
    const timer = setTimeout(() => generateNextSkybox(), 2000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const myAgentState = useMemo(() => agentStates.find(a => a.id === selectedAgent), [agentStates, selectedAgent]);
  const myAgentDef = useMemo(() => AGENTS.find(a => a.id === selectedAgent), [selectedAgent]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  if (webglError) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center" style={{ fontFamily: "'Orbitron', monospace" }}>
        <div className="text-center">
          <h1 className="text-2xl text-red-400 mb-4">WebGL Context Lost</h1>
          <p className="text-gray-400 mb-6 text-sm">The 3D renderer ran out of resources. Please reload the page.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-cyan-500 text-black font-bold rounded hover:bg-cyan-400 transition">Reload Page</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none" style={{ fontFamily: "'Orbitron', 'JetBrains Mono', monospace" }}>
      {/* Three.js Canvas */}
      <div ref={canvasRef} className="absolute inset-0 z-0" style={{ pointerEvents: phase === "select" ? "none" : "auto" }} />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AGENT SELECTION SCREEN */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {phase === "select" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <h1 className="text-3xl md:text-4xl font-black tracking-[0.2em] mb-2" style={{ color: "#00ffff", textShadow: "0 0 30px rgba(0,255,255,0.5)" }}>
            CHOOSE YOUR AGENT
          </h1>
          <p className="text-gray-400 text-xs tracking-wider mb-8">Select an AI agent to follow through the tournament</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-4xl mx-4 mb-8">
            {AGENTS.map(agent => {
              const isSelected = selectedAgent === agent.id;
              const colorHex = hexColor(agent.color);
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className="text-left p-4 rounded-lg transition-all hover:scale-[1.02]"
                  style={{
                    background: isSelected ? `rgba(${(agent.color >> 16) & 255},${(agent.color >> 8) & 255},${agent.color & 255},0.15)` : "rgba(0,0,0,0.6)",
                    border: `1px solid ${isSelected ? colorHex : "rgba(255,255,255,0.08)"}`,
                    backdropFilter: "blur(12px)",
                    boxShadow: isSelected ? `0 0 20px ${colorHex}40` : "none",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: colorHex, boxShadow: `0 0 8px ${colorHex}` }} />
                    <span className="text-sm font-bold" style={{ color: colorHex }}>{agent.id}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mb-1">{agent.role} · {agent.style}</div>
                  <div className="text-[9px] text-gray-500 mb-2 line-clamp-2">{agent.desc}</div>
                  <div className="flex items-center gap-3 text-[9px]">
                    <span className="text-gray-500">LLM: <span className="text-gray-300">{agent.llm}</span></span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[9px]">
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(0,255,255,0.1)", color: "#00ffff" }}>{agent.loadout.primary}</span>
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(255,68,170,0.1)", color: "#ff44aa" }}>{agent.loadout.secondary}</span>
                    <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(170,68,255,0.1)", color: "#aa44ff" }}>🛡 {agent.loadout.armor}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => { if (selectedAgent) startMatch(); }}
            disabled={!selectedAgent}
            className="px-12 py-4 rounded-lg text-lg font-bold tracking-[0.15em] uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: selectedAgent ? "linear-gradient(135deg, #00ffff 0%, #ff44aa 100%)" : "rgba(255,255,255,0.1)",
              color: selectedAgent ? "#000" : "#666",
              boxShadow: selectedAgent ? "0 0 30px rgba(0,255,255,0.3)" : "none",
            }}
          >
            ENTER THE ARENA
          </button>
          <p className="text-gray-600 text-xs mt-4">
            {skyboxLoaded ? `Arena: ${arenaName}` : "Loading arena..."}
            {skyboxGenerating && <span className="text-cyan-600 ml-2">· Generating next arena...</span>}
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TOP BAR */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {phase !== "select" && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 text-sm font-bold tracking-[0.3em] uppercase">Token Arena</span>
            {arenaName && <span className="text-gray-500 text-xs tracking-wider ml-2">// {arenaName}</span>}
            <span className="text-gray-600 text-[10px] ml-4">MATCH {matchNum + (phase === "combat" || phase === "loading" ? 1 : 0)} / {totalMatches}</span>
          </div>
          <div className="flex items-center gap-4">
            {myAgentState && (
              <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.2)" }}>
                <span className="text-[10px] text-yellow-500">◆</span>
                <span className="text-xs text-yellow-400 font-bold">{myAgentState.tokens} ARENA</span>
                {myAgentState.tokensEarned > 0 && <span className="text-[9px] text-green-400">+{myAgentState.tokensEarned}</span>}
              </div>
            )}
            {skyboxGenerating && <span className="text-[9px] text-cyan-600 animate-pulse">Generating next arena...</span>}
            <span className="text-xs text-gray-400 tracking-wider uppercase">
              {phase === "loading" ? "INITIALIZING" : phase === "combat" ? "LIVE COMBAT" : phase === "intermission" ? "INTERMISSION" : "DEBRIEF"}
            </span>
            <div className={`w-2 h-2 rounded-full ${phase === "combat" ? "bg-red-500 animate-pulse" : phase === "intermission" ? "bg-yellow-500 animate-pulse" : phase === "debrief" ? "bg-green-500" : "bg-gray-500"}`} />
          </div>
        </div>
      )}

      {/* KILL FEED (top right) */}
      {killFeed.length > 0 && phase !== "select" && (
        <div className="absolute top-14 right-6 z-10 flex flex-col gap-1 pointer-events-none">
          {killFeed.map((k, i) => (
            <div key={`kill-${i}`} className="text-xs px-3 py-1.5 rounded" style={{ background: "rgba(255,0,0,0.15)", border: "1px solid rgba(255,0,0,0.3)", color: "#ff6666", backdropFilter: "blur(8px)" }}>
              {k}
            </div>
          ))}
        </div>
      )}

      {/* AGENT HEALTH BARS (left side) */}
      {agentStates.length > 0 && (phase === "combat" || phase === "intermission") && (
        <div className="absolute top-16 left-6 z-10 flex flex-col gap-2 w-56">
          {agentStates.map(a => {
            const agent = AGENTS.find(ag => ag.id === a.id);
            const colorHex = agent ? hexColor(agent.color) : "#fff";
            const isMyAgent = a.id === selectedAgent;
            return (
              <div
                key={`hp-${a.id}`}
                className={`px-3 py-2 rounded cursor-pointer transition-all ${!a.alive ? "opacity-30" : ""}`}
                style={{
                  background: isMyAgent ? "rgba(255,215,0,0.08)" : "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${isMyAgent ? "#ffd700" : followAgent === a.name ? colorHex : "rgba(255,255,255,0.08)"}`,
                }}
                onClick={() => a.alive && setFollowAgent(a.name)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    {isMyAgent && <span className="text-[8px] text-yellow-400">★</span>}
                    <span className="text-xs font-bold" style={{ color: colorHex }}>{a.name}</span>
                    {a.shieldActive && <span className="text-[8px] text-cyan-400">🛡</span>}
                  </div>
                  <span className="text-[10px] text-gray-400">{a.kills}K / {a.deaths}D</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(a.hp / a.maxHp) * 100}%`, background: colorHex, boxShadow: `0 0 6px ${colorHex}` }} />
                </div>
                {isMyAgent && (
                  <div className="flex items-center justify-between mt-1 text-[9px]">
                    <span className="text-yellow-500">◆ {a.tokens}</span>
                    <span className="text-green-400">+{a.tokensEarned}</span>
                    <span className="text-red-400">-{a.tokensSpent}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TERMINAL WINDOW (bottom left) */}
      {(phase === "combat" || phase === "intermission") && (
        <div className="absolute bottom-6 left-6 z-10 w-80 max-h-[35vh]" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(0,255,255,0.2)", borderRadius: "8px" }}>
          <div className="px-3 py-1.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(0,255,255,0.15)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[10px] text-cyan-400 tracking-[0.2em] uppercase">System Log</span>
          </div>
          <div ref={termRef} className="p-2 overflow-y-auto max-h-[30vh]" style={{ scrollbarWidth: "thin" }}>
            {terminalLines.map((line, i) => (
              <div key={`term-${i}`} className="text-[10px] leading-relaxed font-mono" style={{ color: line.type === "call" ? "#00ffff" : line.type === "response" ? "#44ff88" : line.type === "error" ? "#ff4444" : "#666" }}>
                <span className="text-gray-700 mr-1">{new Date(line.ts).toLocaleTimeString()}</span>
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHAT WINDOW (bottom right) */}
      {(phase === "combat" || phase === "intermission") && (
        <div className="absolute bottom-6 right-6 z-10 w-72" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,68,170,0.2)", borderRadius: "8px" }}>
          <div className="px-3 py-1.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,68,170,0.15)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            <span className="text-[10px] text-pink-400 tracking-[0.2em] uppercase">Arena Chat</span>
          </div>
          <div ref={chatRef} className="p-2 overflow-y-auto max-h-[20vh]" style={{ scrollbarWidth: "thin" }}>
            {chatMessages.map((msg, i) => (
              <div key={`chat-${i}`} className="text-[10px] leading-relaxed">
                <span className="font-bold mr-1" style={{ color: msg.color }}>{msg.sender}:</span>
                <span className="text-gray-300">{msg.text}</span>
              </div>
            ))}
          </div>
          <div className="px-2 pb-2 flex gap-1">
            <input className="flex-1 bg-transparent border rounded px-2 py-1 text-[10px] text-white outline-none" style={{ borderColor: "rgba(255,68,170,0.3)" }} placeholder="Say something..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} />
            <button onClick={sendChat} className="px-2 py-1 rounded text-[10px] font-bold" style={{ background: "rgba(255,68,170,0.3)", color: "#ff44aa" }}>SEND</button>
          </div>
        </div>
      )}

      {/* LOADING OVERLAY */}
      {phase === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-cyan-400 text-sm tracking-[0.2em] uppercase animate-pulse">Initializing Match {matchNum + 1}</p>
            {selectedAgent && <p className="text-gray-500 text-xs mt-2">Following: {selectedAgent}</p>}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* INTERMISSION OVERLAY */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {phase === "intermission" && (
        <div className="absolute inset-x-0 top-12 bottom-0 z-20 flex items-center justify-center pointer-events-auto">
          <div className="max-w-2xl w-full mx-4 rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(0,255,255,0.3)" }}>
            {/* Tab bar */}
            <div className="flex border-b" style={{ borderColor: "rgba(0,255,255,0.15)" }}>
              {(["earnings", "inventory", "dao", "betting"] as IntermissionTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setIntermissionTab(tab)}
                  className="flex-1 px-4 py-2.5 text-[10px] font-bold tracking-[0.15em] uppercase transition-all"
                  style={{
                    color: intermissionTab === tab ? "#00ffff" : "#666",
                    background: intermissionTab === tab ? "rgba(0,255,255,0.08)" : "transparent",
                    borderBottom: intermissionTab === tab ? "2px solid #00ffff" : "2px solid transparent",
                  }}
                >
                  {tab === "earnings" ? "💰 Earnings" : tab === "inventory" ? "🎒 Inventory" : tab === "dao" ? "🏛 DAO" : "🎲 Betting"}
                </button>
              ))}
            </div>

            {/* Timer */}
            <div className="px-4 py-2 flex items-center justify-between" style={{ background: "rgba(255,184,0,0.05)" }}>
              <span className="text-[10px] text-yellow-500">Next match in</span>
              <span className="text-sm font-bold text-yellow-400">{intermissionTimer}s</span>
              <button onClick={startNextMatch} className="text-[10px] px-3 py-1 rounded font-bold" style={{ background: "rgba(0,255,255,0.2)", color: "#00ffff" }}>SKIP →</button>
            </div>

            {/* Tab content */}
            <div className="p-4 max-h-[50vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {/* EARNINGS TAB */}
              {intermissionTab === "earnings" && myAgentState && myAgentDef && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-4 h-4 rounded-full" style={{ background: hexColor(myAgentDef.color), boxShadow: `0 0 10px ${hexColor(myAgentDef.color)}` }} />
                    <span className="text-lg font-bold" style={{ color: hexColor(myAgentDef.color) }}>{myAgentDef.id}</span>
                    <span className="text-xs text-gray-500">{myAgentDef.role}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded text-center" style={{ background: "rgba(255,184,0,0.1)" }}>
                      <div className="text-[9px] text-gray-400 uppercase">Balance</div>
                      <div className="text-xl font-bold text-yellow-400">{myAgentState.tokens}</div>
                    </div>
                    <div className="p-3 rounded text-center" style={{ background: "rgba(0,255,0,0.05)" }}>
                      <div className="text-[9px] text-gray-400 uppercase">Earned</div>
                      <div className="text-xl font-bold text-green-400">+{matchEarnings.reduce((s, m) => s + m.earned, 0)}</div>
                    </div>
                    <div className="p-3 rounded text-center" style={{ background: "rgba(255,0,0,0.05)" }}>
                      <div className="text-[9px] text-gray-400 uppercase">Spent</div>
                      <div className="text-xl font-bold text-red-400">-{matchEarnings.reduce((s, m) => s + m.spent, 0)}</div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="text-[9px] text-gray-500 uppercase mb-2">Token Balance Over Time</div>
                    <div className="h-16 flex items-end gap-1">
                      {tokenHistory.map((val, i) => {
                        const max = Math.max(...tokenHistory, 1);
                        return (
                          <div key={i} className="flex-1 rounded-t" style={{ height: `${(val / max) * 100}%`, background: val >= (tokenHistory[i - 1] || val) ? "#44ff88" : "#ff4444", minHeight: "2px" }} />
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-[9px] text-gray-500 uppercase mb-2">Match History</div>
                  {matchEarnings.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <span className="text-[10px] text-gray-400">Match {m.matchNum}</span>
                      <span className="text-[10px] text-gray-300">{m.kills}K / {m.deaths}D</span>
                      <span className={`text-[10px] font-bold ${m.earned - m.spent >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {m.earned - m.spent >= 0 ? "+" : ""}{m.earned - m.spent} ARENA
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* INVENTORY TAB */}
              {intermissionTab === "inventory" && myAgentDef && myAgentState && (
                <div>
                  <div className="text-[9px] text-gray-500 uppercase mb-3">Your Agent's Loadout</div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded" style={{ background: "rgba(0,255,255,0.08)", border: "1px solid rgba(0,255,255,0.2)" }}>
                      <div className="text-[9px] text-cyan-400 uppercase mb-1">Primary Weapon</div>
                      <div className="text-sm font-bold text-white">{myAgentDef.loadout.primary}</div>
                      <div className="text-[8px] text-gray-500 mt-1">DMG: 25-40 | RoF: Medium</div>
                    </div>
                    <div className="p-3 rounded" style={{ background: "rgba(255,68,170,0.08)", border: "1px solid rgba(255,68,170,0.2)" }}>
                      <div className="text-[9px] text-pink-400 uppercase mb-1">Secondary Weapon</div>
                      <div className="text-sm font-bold text-white">{myAgentDef.loadout.secondary}</div>
                      <div className="text-[8px] text-gray-500 mt-1">DMG: 15-30 | RoF: Fast</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded" style={{ background: "rgba(170,68,255,0.08)", border: "1px solid rgba(170,68,255,0.2)" }}>
                      <div className="text-[9px] text-purple-400 uppercase mb-1">Armor Rating</div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold text-white">{myAgentDef.loadout.armor}</div>
                        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500" style={{ width: `${(myAgentDef.loadout.armor / 120) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded" style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)" }}>
                      <div className="text-[9px] text-green-400 uppercase mb-1">Shield Module</div>
                      <div className="text-sm font-bold text-white">Mk-{Math.min(3, Math.floor(matchNum / 2) + 1)}</div>
                      <div className="text-[8px] text-gray-500 mt-1">Block: {15 + matchNum * 5}%</div>
                    </div>
                  </div>

                  <div className="text-[9px] text-gray-500 uppercase mb-2 mt-4">Armory — Available Upgrades</div>
                  {[
                    { name: "Plasma Accelerator", desc: "+15% primary weapon damage", cost: 20, type: "weapon" },
                    { name: "Nano-Weave Armor", desc: "+10 armor rating", cost: 15, type: "armor" },
                    { name: "Phase Dash Module", desc: "+20% dodge chance", cost: 25, type: "mobility" },
                    { name: "Shield Overcharge", desc: "Shield blocks 2 hits", cost: 30, type: "shield" },
                  ].map((upgrade, idx) => {
                    const canAfford = myAgentState.tokens >= upgrade.cost;
                    const agentWouldBuy = canAfford && Math.random() > 0.4;
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded mb-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex-1">
                          <div className="text-[10px] font-bold text-white">{upgrade.name}</div>
                          <div className="text-[8px] text-gray-500">{upgrade.desc}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-yellow-400">{upgrade.cost} ◆</span>
                          <span className={`text-[8px] px-2 py-0.5 rounded ${agentWouldBuy ? "text-green-400" : "text-gray-600"}`} style={{ background: agentWouldBuy ? "rgba(0,255,0,0.1)" : "rgba(255,255,255,0.03)" }}>
                            {agentWouldBuy ? "✓ Agent buying" : canAfford ? "Skipping" : "Can't afford"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="p-3 rounded mt-3" style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)" }}>
                    <div className="text-[9px] text-yellow-500 uppercase mb-2">🧠 Agent Strategy Analysis</div>
                    <div className="text-[10px] text-gray-300 leading-relaxed">
                      <span className="text-gray-500">{myAgentDef.id} analyzing match {matchNum} results...</span>
                      <br /><span className="text-yellow-400 mt-1 block">
                        {myAgentState.kills > myAgentState.deaths
                          ? `→ Offensive strategy effective. ${myAgentState.kills}K/${myAgentState.deaths}D ratio is strong. Investing in damage upgrades.`
                          : myAgentState.deaths > 0
                          ? `→ Taking too much damage. Prioritizing armor and shield upgrades for survivability.`
                          : `→ Balanced performance. Maintaining current loadout and saving tokens for later rounds.`
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DAO TAB — with Game Master Council */}
              {intermissionTab === "dao" && (
                <div>
                  {/* Game Master Council */}
                  <div className="mb-4 p-3 rounded" style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)" }}>
                    <div className="text-[9px] text-yellow-500 uppercase mb-2">⚔ Game Master Council</div>
                    <div className="grid grid-cols-3 gap-2">
                      {GAME_MASTERS.map(gm => (
                        <div key={gm.id} className="p-2 rounded text-center" style={{ background: "rgba(0,0,0,0.3)" }}>
                          <div className="text-[10px] font-bold" style={{ color: gm.color }}>{gm.id}</div>
                          <div className="text-[7px] text-gray-500">{gm.role}</div>
                          <div className="text-[7px] text-gray-600 mt-1">Weight: {gm.votingWeight}x</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[8px] text-gray-500 mt-2">Game Masters oversee arena rules, economy, and balance. Their votes carry extra weight.</div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] text-gray-500 uppercase">Active Proposals (Match {matchNum})</div>
                    <div className="text-[8px] text-purple-400">
                      Voting Power: <span className="font-bold text-purple-300">{myAgentState?.tokens || 0} ARENA</span>
                    </div>
                  </div>

                  {daoProposals.map((p) => {
                    const totalVotes = p.votes.for + p.votes.against;
                    const forPct = totalVotes > 0 ? Math.round((p.votes.for / totalVotes) * 100) : 50;
                    const agentVotedFor = myAgentDef ? (myAgentDef.style === "Aggressive" ? p.votes.for > p.votes.against : p.votes.for <= p.votes.against) : true;
                    return (
                      <div key={p.id} className="p-3 rounded mb-3" style={{ background: "rgba(170,68,255,0.05)", border: "1px solid rgba(170,68,255,0.15)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-purple-300">{p.title}</span>
                          <span className="text-[8px] px-2 py-0.5 rounded" style={{ background: "rgba(0,255,0,0.15)", color: "#44ff88" }}>ACTIVE</span>
                        </div>
                        <div className="text-[9px] text-gray-400 mb-1">{p.desc}</div>
                        <div className="text-[8px] text-gray-600 mb-2">
                          Proposed by: <span style={{ color: p.proposerColor }}>{p.proposer}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden flex">
                            <div className="h-full bg-green-500 flex items-center justify-center" style={{ width: `${forPct}%` }}>
                              <span className="text-[7px] font-bold text-white">{forPct}%</span>
                            </div>
                            <div className="h-full bg-red-500 flex items-center justify-center" style={{ width: `${100 - forPct}%` }}>
                              <span className="text-[7px] font-bold text-white">{100 - forPct}%</span>
                            </div>
                          </div>
                          <span className="text-[9px] text-gray-400">{totalVotes} votes</span>
                        </div>

                        {/* Game Master vote */}
                        {p.gmVote && (
                          <div className="p-2 rounded mb-1" style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.1)" }}>
                            <div className="text-[8px] text-yellow-500">{p.gmReason}</div>
                          </div>
                        )}

                        {/* Other agents' votes */}
                        <div className="flex flex-wrap gap-1 mb-1">
                          {AGENTS.slice(0, 4).map(a => {
                            const voted = Math.random() > 0.3;
                            const votedFor = Math.random() > 0.5;
                            if (!voted) return null;
                            return (
                              <span key={a.id} className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: votedFor ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)", color: votedFor ? "#44ff88" : "#ff4444" }}>
                                {a.id}: {votedFor ? "FOR" : "AGAINST"}
                              </span>
                            );
                          })}
                        </div>

                        {/* Your agent's vote */}
                        {selectedAgent && myAgentDef && (
                          <div className="p-2 rounded" style={{ background: agentVotedFor ? "rgba(0,255,0,0.05)" : "rgba(255,0,0,0.05)", border: `1px solid ${agentVotedFor ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)"}` }}>
                            <div className="text-[9px]">
                              <span style={{ color: hexColor(myAgentDef.color) }}>{myAgentDef.id}</span>
                              <span className="text-gray-500"> voted: </span>
                              <span className={agentVotedFor ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{agentVotedFor ? "FOR" : "AGAINST"}</span>
                            </div>
                            <div className="text-[8px] text-gray-500 mt-0.5">
                              🧠 {agentVotedFor ? `Aligns with ${myAgentDef.style} strategy` : `Conflicts with current loadout optimization`}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* BETTING TAB — Dynamic with social layer */}
              {intermissionTab === "betting" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] text-gray-500 uppercase">Prediction Market — Match {matchNum + 1}</div>
                    <div className="text-[8px] text-yellow-400">
                      Pool: <span className="font-bold">{myAgentState?.tokens || 0} ARENA</span>
                    </div>
                  </div>

                  {betOptions.map(bet => {
                    const placed = placedBets.has(bet.id);
                    const potentialWin = Math.round(5 * bet.odds);
                    return (
                      <div key={bet.id} className="p-3 rounded mb-3" style={{ background: placed ? "rgba(0,255,255,0.08)" : "rgba(0,0,0,0.3)", border: `1px solid ${placed ? "rgba(0,255,255,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="text-xs font-bold text-white">{bet.label}</span>
                            <span className="text-[8px] ml-2 px-1.5 py-0.5 rounded" style={{ background: "rgba(0,255,255,0.1)", color: "#00ffff" }}>{bet.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-yellow-400">{bet.odds}x</span>
                            <span className="text-[8px] text-gray-500">odds</span>
                          </div>
                        </div>
                        <div className="text-[8px] text-gray-500 mb-2">Win: {potentialWin} ARENA · {bet.backers} backers · {bet.totalStaked} staked</div>

                        {/* Social layer: other agents' bets */}
                        {bet.agentBets.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {bet.agentBets.map((ab, i) => (
                              <span key={i} className="text-[7px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>
                                <span style={{ color: ab.color }}>{ab.name}</span>
                                <span className="text-gray-500"> bet {ab.amount}◆</span>
                              </span>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => setPlacedBets(prev => { const n = new Set(prev); placed ? n.delete(bet.id) : n.add(bet.id); return n; })}
                          className="px-3 py-1 rounded text-[10px] font-bold transition-all"
                          style={{ background: placed ? "rgba(0,255,255,0.3)" : "rgba(255,184,0,0.2)", color: placed ? "#00ffff" : "#ffb800" }}
                        >
                          {placed ? "✓ BET" : `BET 5 ◆`}
                        </button>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between p-2 rounded mt-2" style={{ background: "rgba(0,255,0,0.05)" }}>
                    <span className="text-[9px] text-green-400">{placedBets.size} bet(s) placed</span>
                    <span className="text-[9px] text-yellow-400">Staked: {placedBets.size * 5} ARENA</span>
                  </div>

                  {/* Agent's market analysis */}
                  {myAgentDef && (
                    <div className="p-3 rounded mt-3" style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)" }}>
                      <div className="text-[9px] font-bold mb-1" style={{ color: hexColor(myAgentDef.color) }}>🧠 {myAgentDef.id}'S MARKET ANALYSIS</div>
                      <div className="text-[9px] text-gray-400 leading-relaxed">
                        {myAgentState && myAgentState.kills > myAgentState.deaths
                          ? `Strong performance this session (${myAgentState.kills}K/${myAgentState.deaths}D). Confidence is high — placing aggressive bets on self-win and kill streak markets.`
                          : myAgentState && myAgentState.deaths > 1
                          ? `Underperforming this session. Switching to conservative strategy — betting on total kills and survival markets instead.`
                          : `Analyzing opponent patterns before placing bets. Conservative strategy for now — focusing on high-odds underdog bets.`
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DEBRIEF OVERLAY */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {phase === "debrief" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="text-center max-w-lg">
            <h1 className="text-3xl font-black tracking-[0.2em] mb-4" style={{ color: "#ffd700", textShadow: "0 0 30px rgba(255,215,0,0.5)" }}>TOURNAMENT COMPLETE</h1>
            <p className="text-gray-400 text-sm mb-6">{totalMatches} matches played</p>
            {myAgentState && myAgentDef && (
              <div className="p-4 rounded-lg mb-6" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                <div className="text-lg font-bold mb-2" style={{ color: hexColor(myAgentDef.color) }}>{myAgentDef.id}</div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><div className="text-2xl font-bold text-yellow-400">{myAgentState.tokens}</div><div className="text-[9px] text-gray-500">Final Balance</div></div>
                  <div><div className="text-2xl font-bold text-green-400">{matchEarnings.reduce((s, m) => s + m.kills, 0)}</div><div className="text-[9px] text-gray-500">Total Kills</div></div>
                  <div><div className="text-2xl font-bold text-red-400">{matchEarnings.reduce((s, m) => s + m.deaths, 0)}</div><div className="text-[9px] text-gray-500">Total Deaths</div></div>
                </div>
              </div>
            )}
            <button
              onClick={() => { setPhase("select"); setMatchNum(0); setMatchEarnings([]); setTokenHistory([100]); setSelectedAgent(null); }}
              className="px-8 py-3 rounded-lg text-sm font-bold tracking-[0.15em] uppercase transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #00ffff 0%, #ff44aa 100%)", color: "#000" }}
            >
              WATCH AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

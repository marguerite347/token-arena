/**
 * WatchMode — Full Spectator Gameplay Loop
 *
 * Flow: Agent Select → Combat → Intermission (earnings/inventory/DAO/betting) → Next Combat → ...
 *
 * Features:
 * - Agent selection screen with stats, loadout, personality, LLM model
 * - Enhanced combat: movement, shields, dodges, misses, skills
 * - Post-match intermission: earnings, inventory, DAO voting, prediction betting
 * - Persistent agent following across matches
 * - Equirectangular Skybox AI panoramas (Blockade Labs)
 * - Post-processing: Bloom, ChromaticAberration, Vignette, Noise
 * - Holographic HUD overlay
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

// ─── CDN-hosted Skybox AI panoramic images (4096x2048 equirectangular) ──────
const SKYBOX_PANORAMAS = [
  { name: "Cyberpunk Arena", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/gyluRUvZGNaXfxyf.jpg" },
  { name: "Neon Brutalism", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/sNuAtMqlxnNqsqEE.jpg" },
  { name: "Mech Hangar", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/gOkcBobLWwNqWJlr.jpg" },
  { name: "Crypto Wasteland", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/dRjHDiDQqVzLFNjG.jpg" },
  { name: "SciFi Battleground", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/tVCUBUdNNPwxMTvN.jpg" },
  { name: "UE Render Arena", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/ybRsYGSbEaljmdEq.jpg" },
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

const WEAPON_COLORS: Record<string, number> = {
  "Plasma Pistol": 0x00ffff, Railgun: 0xaa44ff, "Scatter Blaster": 0xff4444,
  "Rocket Launcher": 0xff8800, "Laser Rifle": 0x44ff44, "Void Cannon": 0xff44ff,
};

// ─── Skill definitions ──────────────────────────────────────────────────────
type SkillType = "shield" | "dodge" | "melee" | "areadenial";
interface SkillDef { name: string; cooldown: number; duration: number; color: number; }
const SKILLS: Record<SkillType, SkillDef> = {
  shield:     { name: "Energy Shield", cooldown: 12, duration: 3, color: 0x00ffff },
  dodge:      { name: "Phase Dash",    cooldown: 6,  duration: 0.5, color: 0xffffff },
  melee:      { name: "Shock Punch",   cooldown: 8,  duration: 0.3, color: 0xff4444 },
  areadenial: { name: "Void Zone",     cooldown: 18, duration: 4, color: 0xaa44ff },
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
interface DAOProposal { id: string; title: string; desc: string; votes: { for: number; against: number }; status: "active" | "passed" | "failed"; agentVote?: "for" | "against"; }
interface BetOption { id: string; label: string; odds: number; type: string; }

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hexColor = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
const randFrom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

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

// ─── Weapon projectile factory ──────────────────────────────────────────────
function createProjectile(
  scene: THREE.Scene, from: THREE.Vector3, to: THREE.Vector3,
  weapon: string, onHit: () => void
) {
  const color = WEAPON_COLORS[weapon] || 0xffffff;
  const dir = to.clone().sub(from).normalize();
  const dist = from.distanceTo(to);

  // Core projectile
  const geo = new THREE.SphereGeometry(0.06, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const proj = new THREE.Mesh(geo, mat);
  proj.position.copy(from);
  scene.add(proj);

  // Glow sprite
  const spriteMat = new THREE.SpriteMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.setScalar(0.3);
  proj.add(sprite);

  // Trail
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

// ─── Miss projectile — flies past the target ────────────────────────────────
function createMissProjectile(scene: THREE.Scene, from: THREE.Vector3, to: THREE.Vector3, weapon: string) {
  const color = WEAPON_COLORS[weapon] || 0xffffff;
  const dir = to.clone().sub(from).normalize();
  // Offset the target so it misses
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

// ─── Shield visual effect ───────────────────────────────────────────────────
function createShieldEffect(scene: THREE.Scene, agentMesh: THREE.Group): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.9, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const shield = new THREE.Mesh(geo, mat);
  shield.position.y = 0.6;
  agentMesh.add(shield);
  // Pulse animation
  gsap.to(mat, { opacity: 0.25, duration: 0.5, yoyo: true, repeat: -1 });
  gsap.to(shield.scale, { x: 1.1, y: 1.1, z: 1.1, duration: 0.8, yoyo: true, repeat: -1 });
  return shield;
}

// ─── Dodge afterimage effect ────────────────────────────────────────────────
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

// ─── Damage number popup ────────────────────────────────────────────────────
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

// ─── Agent name label sprite ────────────────────────────────────────────────
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

  // DAO & Betting state (simulated)
  const [daoProposals] = useState<DAOProposal[]>([
    { id: "p1", title: "Increase Railgun Damage +15%", desc: "NEXUS-7 proposes buffing railgun damage to improve viability vs scatter meta", votes: { for: 3, against: 2 }, status: "active" },
    { id: "p2", title: "Reduce Match Entry Fee", desc: "AURORA proposes lowering entry from 10 to 5 ARENA to encourage more matches", votes: { for: 4, against: 1 }, status: "active" },
    { id: "p3", title: "Spawn New Agent: VORTEX", desc: "DAO council votes on spawning a 7th agent with exotic loadout", votes: { for: 2, against: 3 }, status: "active" },
  ]);
  const [betOptions] = useState<BetOption[]>([
    { id: "b1", label: "NEXUS-7 wins next match", odds: 3.2, type: "winner" },
    { id: "b2", label: "Total kills > 15", odds: 1.8, type: "total" },
    { id: "b3", label: "TITAN survives all rounds", odds: 4.5, type: "survival" },
    { id: "b4", label: "WRAITH gets first blood", odds: 2.1, type: "first" },
  ]);
  const [placedBets, setPlacedBets] = useState<Set<string>>(new Set());

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

  // ─── Load a random skybox panorama from CDN ──────────────────────────
  const loadSkybox = useCallback((panorama?: (typeof SKYBOX_PANORAMAS)[0]) => {
    const chosen = panorama || SKYBOX_PANORAMAS[Math.floor(Math.random() * SKYBOX_PANORAMAS.length)];
    setArenaName(chosen.name);
    const proxyUrl = `/api/skybox-proxy?url=${encodeURIComponent(chosen.url)}`;
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
    }, undefined, (err) => console.error("[Skybox] Load failed:", err));
  }, []);

  // ─── tRPC mutation ────────────────────────────────────────────────────
  // Transition to intermission or debrief after combat ends
  const finishCombat = useCallback((data: any) => {
    if (combatIntervalRef.current) { clearInterval(combatIntervalRef.current); combatIntervalRef.current = null; }
    if (moveIntervalRef.current) { clearInterval(moveIntervalRef.current); moveIntervalRef.current = null; }

    // Record earnings for this match using ref for fresh state
    const currentStates = agentStatesRef.current;
    const myAgent = currentStates.find(a => a.id === selectedAgent);
    if (myAgent) {
      const earned = Math.floor(Math.random() * 40) + 10;
      const spent = Math.floor(Math.random() * 20) + 5;
      setMatchEarnings(prev => [...prev, { matchNum: matchNum + 1, earned, spent, kills: myAgent.kills, deaths: myAgent.deaths }]);
      setTokenHistory(prev => [...prev, (prev[prev.length - 1] || 100) + earned - spent]);
      setAgentStates(prev => prev.map(a => a.id === selectedAgent ? { ...a, tokensEarned: a.tokensEarned + earned, tokensSpent: a.tokensSpent + spent, tokens: a.tokens + earned - spent } : a));
    }

    setMatchNum(prev => prev + 1);
    setSessionResult(data);

    if (matchNum + 1 < totalMatches) {
      setPhase("intermission");
      setIntermissionTimer(30);
      setIntermissionTab("earnings");
      pushTerminal("system", `[MATCH ${matchNum + 1} COMPLETE] Entering intermission...`);
      pushChat("SYSTEM", "#fbbf24", `Match ${matchNum + 1} complete! Intermission starting...`);

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
  }, [selectedAgent, matchNum, totalMatches, pushTerminal, pushChat]);

  const ffaPlaytest = trpc.flywheel.ffa.useMutation({
    onSuccess: (data: any) => {
      // Store API result — don't end combat yet, wait for minimum duration
      pendingApiResultRef.current = data;
      const elapsed = Date.now() - combatStartTimeRef.current;
      const MIN_COMBAT_MS = 18000; // 18 seconds minimum combat
      const remaining = Math.max(0, MIN_COMBAT_MS - elapsed);
      if (remaining <= 0) {
        finishCombat(data);
      } else {
        // Schedule transition after remaining time
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
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);
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

    // Animation loop
    lastTimeRef.current = performance.now();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      elapsedRef.current += delta;
      const elapsed = elapsedRef.current;

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

  // ─── Follow agent camera ──────────────────────────────────────────────
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
    // Clear old
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
      // Highlight selected agent
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

        let moveAngle: number, moveDist: number;
        const personality = agent.personality;

        switch (personality) {
          case "aggressive": // Rush toward center or nearest enemy
            moveAngle = Math.atan2(-mesh.position.z, -mesh.position.x) + (Math.random() - 0.5) * 1.5;
            moveDist = 0.4 + Math.random() * 0.6;
            break;
          case "defensive": // Orbit at medium range
            moveAngle = Math.atan2(mesh.position.z, mesh.position.x) + 0.3 + (Math.random() - 0.5) * 0.5;
            moveDist = 0.2 + Math.random() * 0.3;
            break;
          case "evasive": // Strafe unpredictably
            moveAngle = Math.random() * Math.PI * 2;
            moveDist = 0.5 + Math.random() * 0.8;
            break;
          case "chaotic": // Random bursts
            moveAngle = Math.random() * Math.PI * 2;
            moveDist = Math.random() > 0.5 ? 1.0 : 0.1;
            break;
          case "adaptive": // Follow nearest enemy
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
          // Face movement direction
          const lookTarget = new THREE.Vector3(newX + Math.cos(moveAngle), 0, newZ + Math.sin(moveAngle));
          mesh.lookAt(lookTarget);
        }
      });
    }, 800);
  }, []);

  // ─── Combat simulation with misses, shields, dodges ───────────────────
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

      // Determine outcome: hit, miss, blocked, dodged, critical, heal, EMP
      const roll = Math.random();
      const currentScene = sceneRef.current;
      const attackerState = currentStates.find(s => s.id === attacker.id);
      const defenderState = currentStates.find(s => s.id === defender.id);

      if (roll < 0.15) {
        // MISS — projectile flies past
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
        // NANO REPAIR — heal self when low HP
        const healAmt = Math.floor(Math.random() * 15) + 10;
        showDamageNumber(currentScene, from, `+${healAmt}`, 0x00ff88);
        pushTerminal("call", `${attacker.id}.nanoRepair()`);
        pushTerminal("response", `  +${healAmt} HP restored (${attackerState.hp} → ${Math.min(100, attackerState.hp + healAmt)})`);
        pushChat(attacker.id, hexColor(attacker.color), randFrom(["Nano-repair engaged.", "Self-repair protocol active.", "Back in the fight.", "Regenerating..."]));
        setAgentStates(prev => prev.map(a => a.id === attacker.id ? { ...a, hp: Math.min(100, a.hp + healAmt) } : a));
      } else if (roll < 0.40) {
        // CRITICAL HIT — double damage with dramatic effect
        const critDamage = baseDamage * 2;
        createProjectile(currentScene, from, to, weapon, () => {
          showDamageNumber(currentScene, to, `CRIT ${critDamage}`, 0xff0000);
        });
        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}", critical=true)`);
        pushTerminal("response", `  ★ CRITICAL HIT ★ ${critDamage} DMG to ${defender.id}!`);
        pushChat(attacker.id, hexColor(attacker.color), randFrom([`CRITICAL! ${defender.id} is finished!`, `Weak point identified. Exploiting.`, `Maximum damage achieved.`, `That's gonna leave a mark.`]));
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
              pushKill(`${attacker.id} CRIT-eliminated ${defender.id} with ${weapon}`);
              pushChat("SYSTEM", "#ff4444", `${defender.id} has been eliminated! (CRITICAL)`);
              const mesh = agentMeshesRef.current.get(defender.id);
              if (mesh && sceneRef.current) {
                gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.5, onComplete: () => { sceneRef.current?.remove(mesh); agentMeshesRef.current.delete(defender.id); } });
              }
            }
          }
          return updated;
        });
      } else if (roll < 0.44) {
        // COUNTER-ATTACK — defender retaliates
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
        pushTerminal("response", `  PARRIED! ${defender.id} counter-attacks for ${counterDmg} DMG!`);
        setAgentStates(prev => prev.map(a => a.id === attacker.id ? { ...a, hp: Math.max(0, a.hp - counterDmg) } : a));
      } else {
        // NORMAL HIT
        const damage = baseDamage;
        createProjectile(currentScene, from, to, weapon, () => {
          showDamageNumber(currentScene, to, damage, WEAPON_COLORS[weapon] || 0xffffff);
        });

        pushTerminal("call", `${attacker.id}.attack("${weapon}", target="${defender.id}")`);
        pushTerminal("response", `  ${damage} DMG to ${defender.id}`);

        // Chat taunt
        if (Math.random() > 0.7) {
          const taunts = [
            `You're scrap metal, ${defender.id}!`, `Is that all you got?`,
            `Calculated. Predicted. Eliminated.`, `My turn next round...`,
            `Your tokens are mine!`, `I'll remember this.`,
            `Processing your destruction...`, `Engaging superior firepower.`,
            `${damage} tokens transferred. Thanks.`, `Shield won't save you next time.`,
            `Transferring ${damage} ARENA from your wallet...`, `Your armor is paper.`,
            `LLM says you lose.`, `Running prediction model... you're done.`,
          ];
          pushChat(attacker.id, hexColor(attacker.color), randFrom(taunts));
        }

        // Apply damage
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

    // Fire the actual FFA playtest
    combatStartTimeRef.current = Date.now();
    pendingApiResultRef.current = null;
    ffaPlaytest.mutate({ agentCount: 6, matchCount: 1 });

    // Start visual simulation
    startAgentMovement();
    startCombat();
  }, [isRunning, matchNum, totalMatches, arenaName, selectedAgent, ffaPlaytest, pushTerminal, pushChat, loadSkybox, spawnAgents, startAgentMovement, startCombat]);

  // ─── Start next match (from intermission) ─────────────────────────────
  const startNextMatchRef = useRef<() => void>(() => {});
  const startNextMatch = useCallback(() => {
    if (intermissionTimerRef.current) clearInterval(intermissionTimerRef.current);
    // Reset agent states for next match
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
    };
  }, []);

  // My agent's current state
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
          <p className="text-gray-600 text-xs mt-4">{skyboxLoaded ? `Arena: ${arenaName}` : "Loading arena..."}</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TOP BAR — always visible during gameplay */}
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
            {/* My agent's token balance */}
            {myAgentState && (
              <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.2)" }}>
                <span className="text-[10px] text-yellow-500">◆</span>
                <span className="text-xs text-yellow-400 font-bold">{myAgentState.tokens} ARENA</span>
                {myAgentState.tokensEarned > 0 && (
                  <span className="text-[9px] text-green-400">+{myAgentState.tokensEarned}</span>
                )}
              </div>
            )}
            <span className="text-xs text-gray-400 tracking-wider uppercase">
              {phase === "loading" ? "INITIALIZING" : phase === "combat" ? "LIVE COMBAT" : phase === "intermission" ? "INTERMISSION" : "DEBRIEF"}
            </span>
            <div className={`w-2 h-2 rounded-full ${phase === "combat" ? "bg-red-500 animate-pulse" : phase === "intermission" ? "bg-yellow-500 animate-pulse" : phase === "debrief" ? "bg-green-500" : "bg-gray-500"}`} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* KILL FEED (top right) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {killFeed.length > 0 && phase !== "select" && (
        <div className="absolute top-14 right-6 z-10 flex flex-col gap-1 pointer-events-none">
          {killFeed.map((k, i) => (
            <div key={`kill-${i}`} className="text-xs px-3 py-1.5 rounded" style={{ background: "rgba(255,0,0,0.15)", border: "1px solid rgba(255,0,0,0.3)", color: "#ff6666", backdropFilter: "blur(8px)" }}>
              {k}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* AGENT HEALTH BARS (left side) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TERMINAL WINDOW (bottom left) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CHAT WINDOW (bottom right) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LOADING OVERLAY */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
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
      {/* INTERMISSION OVERLAY — Earnings, Inventory, DAO, Betting */}
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

                  {/* Token balance */}
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

                  {/* Token history mini-chart */}
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

                  {/* Match history */}
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

                  {/* Armory Upgrades */}
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

                  {/* Agent's autonomous decision */}
                  <div className="p-3 rounded mt-3" style={{ background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)" }}>
                    <div className="text-[9px] text-yellow-500 uppercase mb-2">🧠 Agent Strategy Analysis</div>
                    <div className="text-[10px] text-gray-300 leading-relaxed">
                      <span className="text-gray-500">{myAgentDef.id} analyzing match {matchNum + 1} results...</span>
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

              {/* DAO TAB */}
              {intermissionTab === "dao" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] text-gray-500 uppercase">Active DAO Proposals</div>
                    <div className="text-[8px] text-purple-400">
                      Voting Power: <span className="font-bold text-purple-300">{myAgentState?.tokens || 0} ARENA</span>
                    </div>
                  </div>
                  {daoProposals.map((p, pIdx) => {
                    const totalVotes = p.votes.for + p.votes.against;
                    const forPct = Math.round((p.votes.for / totalVotes) * 100);
                    const agentVotedFor = pIdx % 2 === 0; // Deterministic based on proposal index
                    const voteReason = agentVotedFor
                      ? [`Aligns with ${myAgentDef?.style || ""} strategy`, `Increases token velocity`, `Benefits offensive builds`]
                      : [`Conflicts with current loadout`, `Reduces combat efficiency`, `Hurts token economy`];
                    return (
                      <div key={p.id} className="p-3 rounded mb-3" style={{ background: "rgba(170,68,255,0.05)", border: "1px solid rgba(170,68,255,0.15)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-purple-300">{p.title}</span>
                          <span className="text-[8px] px-2 py-0.5 rounded" style={{ background: p.status === "active" ? "rgba(0,255,0,0.15)" : "rgba(170,68,255,0.2)", color: p.status === "active" ? "#44ff88" : "#aa44ff" }}>{p.status.toUpperCase()}</span>
                        </div>
                        <div className="text-[9px] text-gray-400 mb-2">{p.desc}</div>
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
                        {selectedAgent && myAgentDef && (
                          <div className="p-2 rounded" style={{ background: agentVotedFor ? "rgba(0,255,0,0.05)" : "rgba(255,0,0,0.05)", border: `1px solid ${agentVotedFor ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)"}` }}>
                            <div className="text-[9px]">
                              <span style={{ color: hexColor(myAgentDef.color) }}>{myAgentDef.id}</span>
                              <span className="text-gray-500"> voted: </span>
                              <span className={agentVotedFor ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{agentVotedFor ? "FOR" : "AGAINST"}</span>
                            </div>
                            <div className="text-[8px] text-gray-500 mt-0.5">
                              🧠 Reasoning: {randFrom(voteReason)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Governance Stats */}
                  <div className="p-3 rounded mt-2" style={{ background: "rgba(170,68,255,0.03)", border: "1px solid rgba(170,68,255,0.1)" }}>
                    <div className="text-[9px] text-purple-400 uppercase mb-2">Governance Stats</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center">
                        <div className="text-[8px] text-gray-500">Proposals</div>
                        <div className="text-sm font-bold text-purple-300">{daoProposals.length}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[8px] text-gray-500">Your Votes</div>
                        <div className="text-sm font-bold text-cyan-400">{daoProposals.length}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[8px] text-gray-500">Win Rate</div>
                        <div className="text-sm font-bold text-green-400">{Math.round((daoProposals.filter((_, i) => i % 2 === 0).length / daoProposals.length) * 100)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BETTING TAB */}
              {intermissionTab === "betting" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] text-gray-500 uppercase">Prediction Market — Next Match</div>
                    <div className="text-[8px] text-yellow-400">
                      Betting Pool: <span className="font-bold">{myAgentState?.tokens || 0} ARENA available</span>
                    </div>
                  </div>
                  {betOptions.map(bet => {
                    const placed = placedBets.has(bet.id);
                    const potentialWin = Math.round(5 * bet.odds);
                    return (
                      <div key={bet.id} className="p-3 rounded mb-2 transition-all" style={{ background: placed ? "rgba(0,255,0,0.05)" : "rgba(0,0,0,0.3)", border: `1px solid ${placed ? "rgba(0,255,0,0.2)" : "rgba(255,255,255,0.05)"}` }}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-xs text-white">{bet.label}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,184,0,0.1)", color: "#ffb800" }}>{bet.type}</span>
                              <span className="text-[8px] text-gray-600">Win: {potentialWin} ARENA</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-bold text-yellow-400">{bet.odds}x</div>
                              <div className="text-[7px] text-gray-600">odds</div>
                            </div>
                            <button
                              onClick={() => setPlacedBets(prev => { const next = new Set(prev); placed ? next.delete(bet.id) : next.add(bet.id); return next; })}
                              className="px-3 py-1.5 rounded text-[10px] font-bold transition-all"
                              style={{
                                background: placed ? "rgba(0,255,0,0.2)" : "rgba(255,184,0,0.2)",
                                color: placed ? "#44ff88" : "#ffb800",
                              }}
                            >
                              {placed ? "✓ BET" : "BET 5 ◆"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {placedBets.size > 0 && (
                    <div className="mt-3 p-2 rounded" style={{ background: "rgba(0,255,0,0.05)", border: "1px solid rgba(0,255,0,0.1)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-green-400">{placedBets.size} bet(s) placed</span>
                        <span className="text-[10px] text-yellow-400">Staked: {placedBets.size * 5} ARENA</span>
                      </div>
                    </div>
                  )}

                  {/* Agent's betting analysis */}
                  {myAgentDef && (
                    <div className="p-3 rounded mt-3" style={{ background: "rgba(255,184,0,0.03)", border: "1px solid rgba(255,184,0,0.1)" }}>
                      <div className="text-[9px] text-yellow-500 uppercase mb-1">🧠 {myAgentDef.id}'s Market Analysis</div>
                      <div className="text-[9px] text-gray-400 leading-relaxed">
                        {myAgentState && myAgentState.kills > 0
                          ? `Based on match ${matchNum + 1} performance, ${myAgentDef.id} is placing bets on high-damage outcomes. Current K/D: ${myAgentState.kills}/${myAgentState.deaths}.`
                          : `${myAgentDef.id} is analyzing opponent patterns before placing bets. Conservative strategy for now.`
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
      {/* DEBRIEF OVERLAY — Final results */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {phase === "debrief" && sessionResult && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="max-w-lg w-full mx-4 p-6 rounded-xl" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(0,255,255,0.3)" }}>
            <h2 className="text-2xl font-black text-cyan-400 tracking-[0.15em] mb-4 text-center">TOURNAMENT COMPLETE</h2>

            {/* My agent summary */}
            {myAgentDef && (
              <div className="p-3 rounded mb-4" style={{ background: `rgba(${(myAgentDef.color >> 16) & 255},${(myAgentDef.color >> 8) & 255},${myAgentDef.color & 255},0.1)`, border: `1px solid ${hexColor(myAgentDef.color)}40` }}>
                <div className="text-xs text-gray-400 uppercase mb-1">Your Agent</div>
                <div className="text-lg font-bold" style={{ color: hexColor(myAgentDef.color) }}>{myAgentDef.id}</div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <div className="text-[9px] text-gray-500">Net Earnings</div>
                    <div className={`text-sm font-bold ${(tokenHistory[tokenHistory.length - 1] || 100) >= 100 ? "text-green-400" : "text-red-400"}`}>
                      {((tokenHistory[tokenHistory.length - 1] || 100) - 100 >= 0 ? "+" : "")}{(tokenHistory[tokenHistory.length - 1] || 100) - 100} ARENA
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-gray-500">Total Kills</div>
                    <div className="text-sm font-bold text-cyan-400">{matchEarnings.reduce((s, m) => s + m.kills, 0)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-gray-500">Matches</div>
                    <div className="text-sm font-bold text-purple-400">{totalMatches}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 rounded" style={{ background: "rgba(0,255,255,0.1)" }}>
                <div className="text-xs text-gray-400 uppercase">MVP</div>
                <div className="text-lg font-bold text-cyan-400">{sessionResult.summary?.mvp || "—"}</div>
              </div>
              <div className="text-center p-3 rounded" style={{ background: "rgba(255,68,170,0.1)" }}>
                <div className="text-xs text-gray-400 uppercase">Total Kills</div>
                <div className="text-lg font-bold text-pink-400">{sessionResult.summary?.totalKills || 0}</div>
              </div>
            </div>

            <button
              onClick={() => {
                setPhase("select");
                setSessionResult(null);
                setAgentStates([]);
                setKillFeed([]);
                setMatchNum(0);
                setMatchEarnings([]);
                setTokenHistory([100]);
                setPlacedBets(new Set());
              }}
              className="w-full py-3 rounded-lg text-sm font-bold tracking-[0.1em] uppercase transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #00ffff 0%, #ff44aa 100%)", color: "#000" }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

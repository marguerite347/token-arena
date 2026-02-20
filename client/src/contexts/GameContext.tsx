import React, { createContext, useContext, useReducer, useCallback, type ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
export type WeaponType = "plasma" | "railgun" | "scatter" | "missile" | "beam" | "nova";
export type ArmorType = "none" | "light" | "medium" | "heavy" | "shield";
export type GameMode = "pvai" | "aivai" | "idle";
export type GamePhase = "menu" | "loading" | "countdown" | "combat" | "victory" | "defeat" | "shop";

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  tokenCost: number;
  fireRate: number;
  projectileSpeed: number;
  color: string;
  description: string;
}

export interface ShopItem {
  id: string;
  name: string;
  category: "weapon" | "armor" | "consumable" | "environment";
  price: number;
  description: string;
  icon: string;
  weapon?: Weapon;
  armorValue?: number;
  effect?: string;
}

export interface Agent {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  tokens: number;
  weapon: Weapon;
  armor: ArmorType;
  armorValue: number;
  x: number;
  y: number;
  z: number;
  rotation: number;
  isPlayer: boolean;
  isAlive: boolean;
  kills: number;
  color: string;
  erc8004Id?: string;
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  tokenValue: number;
  color: string;
  type: WeaponType;
  createdAt: number;
}

export interface CombatLog {
  id: string;
  timestamp: number;
  message: string;
  type: "damage" | "kill" | "token" | "system" | "shop";
}

export interface SkyboxState {
  id: number | null;
  status: "idle" | "generating" | "ready" | "error";
  imageUrl: string;
  thumbUrl: string;
  depthMapUrl: string;
  prompt: string;
  styleName: string;
}

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  player: Agent;
  agents: Agent[];
  projectiles: Projectile[];
  combatLog: CombatLog[];
  skybox: SkyboxState;
  matchTime: number;
  matchDuration: number;
  tokensEarned: number;
  tokensSpent: number;
  inventory: ShopItem[];
  round: number;
  isPaused: boolean;
  skyboxStyles: Array<{ id: number; name: string }>;
  selectedSkyboxStyle: number;
  skyboxPrompt: string;
}

// ─── Weapons Database ────────────────────────────────────────────────────────
export const WEAPONS: Record<WeaponType, Weapon> = {
  plasma: {
    id: "plasma-1",
    name: "Plasma Blaster",
    type: "plasma",
    damage: 15,
    tokenCost: 2,
    fireRate: 300,
    projectileSpeed: 12,
    color: "#00F0FF",
    description: "Standard plasma rounds. Low cost, reliable damage.",
  },
  railgun: {
    id: "railgun-1",
    name: "Token Railgun",
    type: "railgun",
    damage: 45,
    tokenCost: 8,
    fireRate: 1200,
    projectileSpeed: 25,
    color: "#FF00AA",
    description: "High-damage piercing shot. Expensive but devastating.",
  },
  scatter: {
    id: "scatter-1",
    name: "Scatter Cannon",
    type: "scatter",
    damage: 8,
    tokenCost: 5,
    fireRate: 600,
    projectileSpeed: 10,
    color: "#39FF14",
    description: "Fires 5 token fragments in a spread pattern.",
  },
  missile: {
    id: "missile-1",
    name: "Crypto Missile",
    type: "missile",
    damage: 35,
    tokenCost: 12,
    fireRate: 2000,
    projectileSpeed: 8,
    color: "#FFB800",
    description: "Slow-moving but high-value explosive payload.",
  },
  beam: {
    id: "beam-1",
    name: "Chain Beam",
    type: "beam",
    damage: 5,
    tokenCost: 1,
    fireRate: 50,
    projectileSpeed: 30,
    color: "#00F0FF",
    description: "Continuous beam that drains tokens per tick.",
  },
  nova: {
    id: "nova-1",
    name: "Nova Burst",
    type: "nova",
    damage: 25,
    tokenCost: 15,
    fireRate: 3000,
    projectileSpeed: 6,
    color: "#FF00AA",
    description: "360° token explosion. Hits everything nearby.",
  },
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: "wp-railgun", name: "Token Railgun", category: "weapon", price: 50, description: "High-damage piercing shot", icon: "⚡", weapon: WEAPONS.railgun },
  { id: "wp-scatter", name: "Scatter Cannon", category: "weapon", price: 35, description: "5-fragment spread pattern", icon: "💥", weapon: WEAPONS.scatter },
  { id: "wp-missile", name: "Crypto Missile", category: "weapon", price: 80, description: "Explosive token payload", icon: "🚀", weapon: WEAPONS.missile },
  { id: "wp-beam", name: "Chain Beam", category: "weapon", price: 25, description: "Continuous token drain", icon: "⚡", weapon: WEAPONS.beam },
  { id: "wp-nova", name: "Nova Burst", category: "weapon", price: 100, description: "360° token explosion", icon: "💫", weapon: WEAPONS.nova },
  { id: "ar-light", name: "Light Plating", category: "armor", price: 20, description: "Reduces damage by 10%", icon: "🛡️", armorValue: 10 },
  { id: "ar-medium", name: "Medium Armor", category: "armor", price: 45, description: "Reduces damage by 25%", icon: "🛡️", armorValue: 25 },
  { id: "ar-heavy", name: "Heavy Exosuit", category: "armor", price: 90, description: "Reduces damage by 40%", icon: "🛡️", armorValue: 40 },
  { id: "ar-shield", name: "Energy Shield", category: "armor", price: 120, description: "Absorbs 50 damage then breaks", icon: "🔰", armorValue: 50 },
  { id: "cs-heal", name: "Nano Repair Kit", category: "consumable", price: 15, description: "Restores 30 HP", icon: "💊", effect: "heal-30" },
  { id: "cs-ammo", name: "Token Cache", category: "consumable", price: 10, description: "Grants 50 bonus tokens", icon: "📦", effect: "tokens-50" },
  { id: "cs-speed", name: "Overclock Module", category: "consumable", price: 30, description: "2x fire rate for 10s", icon: "⚡", effect: "speed-10" },
  { id: "env-turret", name: "Auto-Turret", category: "environment", price: 60, description: "Deploys a stationary turret", icon: "🔫", effect: "turret" },
  { id: "env-wall", name: "Energy Barrier", category: "environment", price: 25, description: "Temporary cover wall", icon: "🧱", effect: "wall" },
  { id: "env-mine", name: "Token Mine", category: "environment", price: 35, description: "Proximity-triggered explosion", icon: "💣", effect: "mine" },
];

// ─── Initial State ───────────────────────────────────────────────────────────
const createAgent = (id: string, name: string, isPlayer: boolean, color: string): Agent => ({
  id,
  name,
  health: 100,
  maxHealth: 100,
  tokens: 200,
  weapon: WEAPONS.plasma,
  armor: "none",
  armorValue: 0,
  x: (Math.random() - 0.5) * 20,
  y: 0,
  z: (Math.random() - 0.5) * 20,
  rotation: Math.random() * Math.PI * 2,
  isPlayer,
  isAlive: true,
  kills: 0,
  color,
  erc8004Id: `0x${Math.random().toString(16).slice(2, 10)}`,
});

const AI_NAMES = [
  "NEXUS-7", "CIPHER-X", "VORTEX-3", "PHANTOM-9",
  "STRIKER-1", "ECHO-5", "BLAZE-2", "SHADOW-8",
];

const AI_COLORS = ["#FF00AA", "#39FF14", "#FFB800", "#FF3333", "#AA00FF", "#FF6600", "#00FF88", "#FF0066"];

const initialState: GameState = {
  mode: "idle",
  phase: "menu",
  player: createAgent("player-1", "PLAYER", true, "#00F0FF"),
  agents: [],
  projectiles: [],
  combatLog: [],
  skybox: {
    id: null,
    status: "idle",
    imageUrl: "",
    thumbUrl: "",
    depthMapUrl: "",
    prompt: "",
    styleName: "",
  },
  matchTime: 0,
  matchDuration: 120,
  tokensEarned: 0,
  tokensSpent: 0,
  inventory: [],
  round: 0,
  isPaused: false,
  skyboxStyles: [],
  selectedSkyboxStyle: 89,
  skyboxPrompt: "Futuristic cyberpunk battle arena with neon lights, floating platforms, and holographic displays",
};

// ─── Actions ─────────────────────────────────────────────────────────────────
type GameAction =
  | { type: "SET_MODE"; mode: GameMode }
  | { type: "SET_PHASE"; phase: GamePhase }
  | { type: "START_MATCH"; agents: Agent[] }
  | { type: "UPDATE_PLAYER"; updates: Partial<Agent> }
  | { type: "UPDATE_AGENT"; id: string; updates: Partial<Agent> }
  | { type: "ADD_PROJECTILE"; projectile: Projectile }
  | { type: "REMOVE_PROJECTILE"; id: string }
  | { type: "UPDATE_PROJECTILES"; projectiles: Projectile[] }
  | { type: "ADD_LOG"; log: CombatLog }
  | { type: "SET_SKYBOX"; skybox: Partial<SkyboxState> }
  | { type: "TICK"; delta: number }
  | { type: "SPEND_TOKENS"; amount: number }
  | { type: "EARN_TOKENS"; amount: number }
  | { type: "BUY_ITEM"; item: ShopItem }
  | { type: "EQUIP_WEAPON"; weapon: Weapon }
  | { type: "SET_PAUSED"; paused: boolean }
  | { type: "SET_SKYBOX_STYLES"; styles: Array<{ id: number; name: string }> }
  | { type: "SET_SKYBOX_STYLE"; styleId: number }
  | { type: "SET_SKYBOX_PROMPT"; prompt: string }
  | { type: "AGENT_KILLED"; killerId: string; victimId: string }
  | { type: "RESET_MATCH" };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "START_MATCH":
      return {
        ...state,
        phase: "countdown",
        agents: action.agents,
        projectiles: [],
        matchTime: 0,
        round: state.round + 1,
        player: { ...state.player, health: state.player.maxHealth, isAlive: true, kills: 0, x: 0, y: 0, z: 0, rotation: 0 },
        combatLog: [{ id: "start", timestamp: Date.now(), message: `MATCH ${state.round + 1} INITIATED`, type: "system" }],
      };
    case "UPDATE_PLAYER":
      return { ...state, player: { ...state.player, ...action.updates } };
    case "UPDATE_AGENT":
      return {
        ...state,
        agents: state.agents.map((a) => (a.id === action.id ? { ...a, ...action.updates } : a)),
      };
    case "ADD_PROJECTILE":
      return { ...state, projectiles: [...state.projectiles, action.projectile] };
    case "REMOVE_PROJECTILE":
      return { ...state, projectiles: state.projectiles.filter((p) => p.id !== action.id) };
    case "UPDATE_PROJECTILES":
      return { ...state, projectiles: action.projectiles };
    case "ADD_LOG":
      return { ...state, combatLog: [...state.combatLog.slice(-50), action.log] };
    case "SET_SKYBOX":
      return { ...state, skybox: { ...state.skybox, ...action.skybox } };
    case "TICK":
      return { ...state, matchTime: state.matchTime + action.delta };
    case "SPEND_TOKENS":
      return { ...state, tokensSpent: state.tokensSpent + action.amount, player: { ...state.player, tokens: state.player.tokens - action.amount } };
    case "EARN_TOKENS":
      return { ...state, tokensEarned: state.tokensEarned + action.amount, player: { ...state.player, tokens: state.player.tokens + action.amount } };
    case "BUY_ITEM":
      return {
        ...state,
        player: { ...state.player, tokens: state.player.tokens - action.item.price },
        inventory: [...state.inventory, action.item],
      };
    case "EQUIP_WEAPON":
      return { ...state, player: { ...state.player, weapon: action.weapon } };
    case "SET_PAUSED":
      return { ...state, isPaused: action.paused };
    case "SET_SKYBOX_STYLES":
      return { ...state, skyboxStyles: action.styles };
    case "SET_SKYBOX_STYLE":
      return { ...state, selectedSkyboxStyle: action.styleId };
    case "SET_SKYBOX_PROMPT":
      return { ...state, skyboxPrompt: action.prompt };
    case "AGENT_KILLED": {
      const killer = action.killerId === state.player.id ? "player" : "agent";
      const victim = action.victimId === state.player.id ? "player" : "agent";
      const newState = { ...state };
      if (killer === "player") {
        newState.player = { ...newState.player, kills: newState.player.kills + 1 };
      } else {
        newState.agents = newState.agents.map((a) =>
          a.id === action.killerId ? { ...a, kills: a.kills + 1 } : a
        );
      }
      if (victim === "player") {
        newState.player = { ...newState.player, isAlive: false };
      } else {
        newState.agents = newState.agents.map((a) =>
          a.id === action.victimId ? { ...a, isAlive: false } : a
        );
      }
      return newState;
    }
    case "RESET_MATCH":
      return {
        ...state,
        phase: "menu",
        agents: [],
        projectiles: [],
        matchTime: 0,
        combatLog: [],
      };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────
interface GameContextType {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  startMatch: (mode: GameMode, agentCount?: number) => void;
  fireWeapon: () => void;
  buyItem: (item: ShopItem) => boolean;
  equipWeapon: (weapon: Weapon) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const startMatch = useCallback(
    (mode: GameMode, agentCount = 4) => {
      const agents: Agent[] = [];
      for (let i = 0; i < agentCount; i++) {
        const weaponKeys = Object.keys(WEAPONS) as WeaponType[];
        const randomWeapon = WEAPONS[weaponKeys[Math.floor(Math.random() * weaponKeys.length)]];
        const agent = createAgent(`ai-${i}`, AI_NAMES[i % AI_NAMES.length], false, AI_COLORS[i % AI_COLORS.length]);
        agent.weapon = randomWeapon;
        agent.tokens = 150 + Math.floor(Math.random() * 100);
        agents.push(agent);
      }
      dispatch({ type: "SET_MODE", mode });
      dispatch({ type: "START_MATCH", agents });
    },
    [dispatch]
  );

  const fireWeapon = useCallback(() => {
    if (state.player.tokens < state.player.weapon.tokenCost) return;
    dispatch({ type: "SPEND_TOKENS", amount: state.player.weapon.tokenCost });
  }, [state.player.tokens, state.player.weapon.tokenCost, dispatch]);

  const buyItem = useCallback(
    (item: ShopItem): boolean => {
      if (state.player.tokens < item.price) return false;
      dispatch({ type: "BUY_ITEM", item });
      dispatch({
        type: "ADD_LOG",
        log: { id: `buy-${Date.now()}`, timestamp: Date.now(), message: `Purchased ${item.name} for ${item.price} TKN`, type: "shop" },
      });
      return true;
    },
    [state.player.tokens, dispatch]
  );

  const equipWeapon = useCallback(
    (weapon: Weapon) => {
      dispatch({ type: "EQUIP_WEAPON", weapon });
    },
    [dispatch]
  );

  return (
    <GameContext.Provider value={{ state, dispatch, startMatch, fireWeapon, buyItem, equipWeapon }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

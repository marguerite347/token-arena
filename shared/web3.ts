/**
 * Web3 Constants, Contract ABIs, and Token Definitions
 * Token Arena — Base L2 Integration
 * 
 * ERC-20 tokens deployed on Base Mainnet + Base Sepolia testnet.
 * ERC-4337 smart wallets for autonomous AI agents.
 * ERC-8004 on-chain agent identity.
 * ERC-8021 builder code attribution (tokenarena).
 * x402 payment protocol for machine-native HTTP payments.
 */

import deployedContracts from "./deployed-contracts.json";
import mainnetContracts from "./mainnet-contracts.json";

// ─── Base Mainnet Network Config (PRIMARY) ──────────────────────────────────
export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_MAINNET_RPC = "https://mainnet.base.org";
export const BASE_MAINNET_EXPLORER = "https://basescan.org";

// ─── Base Sepolia Network Config (TESTNET) ──────────────────────────────────
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

// ─── ERC-8021 Builder Code Attribution ──────────────────────────────────────
export const BUILDER_CODE = "tokenarena";
export const ERC8021_SUFFIX = "0x14746f6b656e6172656e610080218021802180218021802180218021";

// ─── Active Network (default: mainnet) ──────────────────────────────────────
export const ACTIVE_CHAIN_ID = BASE_MAINNET_CHAIN_ID;
export const ACTIVE_RPC = BASE_MAINNET_RPC;
export const ACTIVE_EXPLORER = BASE_MAINNET_EXPLORER;

// ─── Deployed Contract Addresses ──────────────────────────────────────────
export const DEPLOYED_TESTNET = deployedContracts;
export const DEPLOYED_MAINNET = mainnetContracts;
export const DEPLOYED = mainnetContracts; // Primary: mainnet

// ─── Token Definitions ─────────────────────────────────────────────────────
export interface TokenDef {
  symbol: string;
  name: string;
  decimals: number;
  address: `0x${string}`;
  costPerShot: number;
  damage: number;
  fireRate: number;
  color: string;
  category: "kinetic" | "energy" | "explosive" | "exotic";
  totalSupply: string;
}

export const WEAPON_TOKENS: Record<string, TokenDef> = {
  plasma: {
    symbol: "PLAS",
    name: "Plasma Ammo Token",
    decimals: 18,
    address: (DEPLOYED.contracts.PLAS || "0x7000000000000000000000000000000000000002") as `0x${string}`,
    costPerShot: 2,
    damage: 15,
    fireRate: 4,
    color: "#00F0FF",
    category: "energy",
    totalSupply: "100000000",
  },
  railgun: {
    symbol: "RAIL",
    name: "Railgun Ammo Token",
    decimals: 18,
    address: (DEPLOYED.contracts.RAIL || "0x7000000000000000000000000000000000000003") as `0x${string}`,
    costPerShot: 8,
    damage: 45,
    fireRate: 0.8,
    color: "#FF00AA",
    category: "kinetic",
    totalSupply: "50000000",
  },
  scatter: {
    symbol: "SCAT",
    name: "Scatter Ammo Token",
    decimals: 18,
    address: (DEPLOYED.contracts.SCAT || "0x7000000000000000000000000000000000000004") as `0x${string}`,
    costPerShot: 5,
    damage: 30,
    fireRate: 1.5,
    color: "#FFB800",
    category: "kinetic",
    totalSupply: "75000000",
  },
  rocket: {
    symbol: "RCKT",
    name: "Rocket Ammo Token",
    decimals: 18,
    address: (DEPLOYED.contracts.RCKT || "0x7000000000000000000000000000000000000005") as `0x${string}`,
    costPerShot: 15,
    damage: 60,
    fireRate: 0.5,
    color: "#FF4400",
    category: "explosive",
    totalSupply: "25000000",
  },
  beam: {
    symbol: "BEAM",
    name: "Beam Ammo Token",
    decimals: 18,
    address: (DEPLOYED.contracts.BEAM || "0x7000000000000000000000000000000000000006") as `0x${string}`,
    costPerShot: 3,
    damage: 10,
    fireRate: 10,
    color: "#39FF14",
    category: "energy",
    totalSupply: "100000000",
  },
  void: {
    symbol: "VOID",
    name: "Void Ammo Token",
    decimals: 18,
    address: (DEPLOYED.contracts.VOID || "0x7000000000000000000000000000000000000007") as `0x${string}`,
    costPerShot: 12,
    damage: 50,
    fireRate: 1,
    color: "#9D00FF",
    category: "exotic",
    totalSupply: "30000000",
  },
};

export const ARENA_TOKEN: TokenDef = {
  symbol: "ARENA",
  name: "Arena Token",
  decimals: 18,
  address: (DEPLOYED.contracts.ARENA || "0x7000000000000000000000000000000000000001") as `0x${string}`,
  costPerShot: 0,
  damage: 0,
  fireRate: 0,
  color: "#39FF14",
  category: "energy",
  totalSupply: "1000000000",
};

// ─── ERC-20 ABI ────────────────────────────────────────────────────────────
export const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "transfer", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "mint", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { name: "batchMint", type: "function", stateMutability: "nonpayable", inputs: [{ name: "recipients", type: "address[]" }, { name: "amounts", type: "uint256[]" }], outputs: [] },
  { name: "Transfer", type: "event", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256", indexed: false }] },
] as const;

// ─── ERC-4337 Account Abstraction for AI Agents ────────────────────────────
export interface AgentSmartWallet {
  agentId: number;
  agentName: string;
  /** ERC-4337 smart contract wallet address */
  walletAddress: `0x${string}`;
  /** The EntryPoint contract address (ERC-4337 standard) */
  entryPoint: `0x${string}`;
  /** Whether this wallet can self-authorize transactions */
  autonomous: boolean;
  /** Token balances managed by the smart wallet */
  balances: Record<string, number>;
  /** Nonce for replay protection */
  nonce: number;
}

/** ERC-4337 EntryPoint on Base Sepolia (standard address) */
export const ERC4337_ENTRY_POINT = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as `0x${string}`;

/** Game contract that manages token flows */
export const GAME_CONTRACT = "0x7000000000000000000000000000000000000100" as `0x${string}`;
export const AGENT_REGISTRY = "0x7000000000000000000000000000000000000200" as `0x${string}`;
export const REPUTATION_REGISTRY = "0x7000000000000000000000000000000000000201" as `0x${string}`;

/** Default AI agent smart wallets — each agent owns its wallet autonomously */
export const AGENT_SMART_WALLETS: AgentSmartWallet[] = [
  { agentId: 1, agentName: "NEXUS-7", walletAddress: (DEPLOYED.agentWallets["agent-1"] || "0xA1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1") as `0x${string}`, entryPoint: ERC4337_ENTRY_POINT, autonomous: true, balances: {}, nonce: 0 },
  { agentId: 2, agentName: "PHANTOM", walletAddress: (DEPLOYED.agentWallets["agent-2"] || "0xA2A2A2A2A2A2A2A2A2A2A2A2A2A2A2A2A2A2A2A2") as `0x${string}`, entryPoint: ERC4337_ENTRY_POINT, autonomous: true, balances: {}, nonce: 0 },
  { agentId: 3, agentName: "TITAN", walletAddress: (DEPLOYED.agentWallets["agent-3"] || "0xA3A3A3A3A3A3A3A3A3A3A3A3A3A3A3A3A3A3A3A3") as `0x${string}`, entryPoint: ERC4337_ENTRY_POINT, autonomous: true, balances: {}, nonce: 0 },
  { agentId: 4, agentName: "CIPHER", walletAddress: (DEPLOYED.agentWallets["agent-4"] || "0xA4A4A4A4A4A4A4A4A4A4A4A4A4A4A4A4A4A4A4A4") as `0x${string}`, entryPoint: ERC4337_ENTRY_POINT, autonomous: true, balances: {}, nonce: 0 },
  { agentId: 5, agentName: "AURORA", walletAddress: (DEPLOYED.agentWallets["agent-5"] || "0xA5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A5A5") as `0x${string}`, entryPoint: ERC4337_ENTRY_POINT, autonomous: true, balances: {}, nonce: 0 },
  { agentId: 6, agentName: "WRAITH", walletAddress: (DEPLOYED.agentWallets["agent-6"] || "0xA6A6A6A6A6A6A6A6A6A6A6A6A6A6A6A6A6A6A6A6") as `0x${string}`, entryPoint: ERC4337_ENTRY_POINT, autonomous: true, balances: {}, nonce: 0 },
];

// ─── ERC-8004 Agent Identity ────────────────────────────────────────────────
export interface AgentIdentity {
  agentId: number;
  name: string;
  description: string;
  image: string;
  owner: `0x${string}`;
  agentRegistry: string;
  stats: {
    totalKills: number;
    totalDeaths: number;
    totalMatches: number;
    totalTokensEarned: number;
    totalTokensSpent: number;
    winRate: number;
    favoriteWeapon: string;
  };
  reputation: number;
  x402Support: boolean;
  active: boolean;
  supportedTrust: string[];
  loadout: {
    primaryWeapon: string;
    secondaryWeapon: string;
    armor: number;
    consumables: string[];
  };
  metadata: Record<string, string>;
}

export const ERC8004_IDENTITY_REGISTRY_ABI = [
  { name: "registerAgent", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentURI", type: "string" }], outputs: [{ name: "agentId", type: "uint256" }] },
  { name: "getAgentURI", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ name: "", type: "string" }] },
  { name: "setAgentURI", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "agentURI", type: "string" }], outputs: [] },
  { name: "getMetadata", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }, { name: "metadataKey", type: "string" }], outputs: [{ name: "", type: "bytes" }] },
  { name: "setMetadata", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "metadataKey", type: "string" }, { name: "metadataValue", type: "bytes" }], outputs: [] },
  { name: "AgentRegistered", type: "event", inputs: [{ name: "agentId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "agentURI", type: "string", indexed: false }] },
] as const;

export const ERC8004_REPUTATION_REGISTRY_ABI = [
  { name: "submitFeedback", type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }, { name: "rating", type: "uint8" }, { name: "comment", type: "string" }, { name: "valueDecimals", type: "uint8" }], outputs: [] },
  { name: "getAverageRating", type: "function", stateMutability: "view", inputs: [{ name: "agentId", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "FeedbackSubmitted", type: "event", inputs: [{ name: "agentId", type: "uint256", indexed: true }, { name: "submitter", type: "address", indexed: true }, { name: "rating", type: "uint8", indexed: false }, { name: "comment", type: "string", indexed: false }] },
] as const;

// ─── x402 Payment Types ─────────────────────────────────────────────────────
export interface X402PaymentRequired {
  resource: string;
  amount: number;
  token: string;
  tokenAddress: `0x${string}`;
  recipient: `0x${string}`;
  chainId: number;
  description: string;
  expiresAt: number;
  paymentId: string;
}

export interface X402PaymentSignature {
  paymentId: string;
  signature: string;
  payer: `0x${string}`;
  amount: number;
  tokenAddress: `0x${string}`;
  nonce: number;
}

export interface X402PaymentResponse {
  success: boolean;
  txHash: string;
  settlement: {
    amount: number;
    token: string;
    from: `0x${string}`;
    to: `0x${string}`;
    blockNumber: number;
    timestamp: number;
  };
}

// ─── Autonomous Agent Decision Types ────────────────────────────────────────
export interface AgentDecision {
  agentId: number;
  agentName: string;
  timestamp: number;
  /** What the agent decided to do */
  action: "buy_weapon" | "buy_armor" | "buy_consumable" | "change_loadout" | "save_tokens" | "invest";
  /** The reasoning behind the decision */
  reasoning: string;
  /** Specific item or configuration chosen */
  target: string;
  /** Token cost of the decision */
  cost: number;
  /** Confidence level (0-1) */
  confidence: number;
  /** Performance data that informed the decision */
  context: {
    recentWinRate: number;
    tokenBalance: number;
    tokenNetPerMatch: number;
    killDeathRatio: number;
    currentLoadout: { primary: string; secondary: string; armor: number };
    matchHistory: Array<{ won: boolean; kills: number; deaths: number; tokensNet: number; weapon: string }>;
  };
}

export interface AgentLearningMemory {
  agentId: number;
  /** Strategies that have worked well */
  successfulStrategies: string[];
  /** Strategies that failed */
  failedStrategies: string[];
  /** Weapon effectiveness ratings learned from experience */
  weaponEffectiveness: Record<string, number>;
  /** Spending patterns that led to sustainability */
  sustainablePatterns: string[];
  /** Total matches analyzed */
  matchesAnalyzed: number;
  /** Current economic health: earning vs spending ratio */
  economicHealth: number;
}

// ─── Default AI Agent Identities ────────────────────────────────────────────
export const DEFAULT_AI_AGENTS: Omit<AgentIdentity, "stats">[] = [
  {
    agentId: 1,
    name: "NEXUS-7",
    description: "Precision-focused combat agent specializing in railgun tactics. Known for calculated, high-damage strikes. ERC-4337 autonomous wallet enables self-directed token management.",
    image: "",
    owner: AGENT_SMART_WALLETS[0].walletAddress,
    agentRegistry: `eip155:${ACTIVE_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 4.2,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "crypto-economic", "erc4337"],
    loadout: { primaryWeapon: "railgun", secondaryWeapon: "plasma", armor: 80, consumables: ["shield_boost"] },
    metadata: { style: "aggressive", difficulty: "hard", walletType: "erc4337" },
  },
  {
    agentId: 2,
    name: "PHANTOM",
    description: "Stealth-oriented agent that favors beam weapons for sustained pressure. Evasive and unpredictable. Self-sustaining through efficient token management.",
    image: "",
    owner: AGENT_SMART_WALLETS[1].walletAddress,
    agentRegistry: `eip155:${ACTIVE_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 3.8,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "erc4337"],
    loadout: { primaryWeapon: "beam", secondaryWeapon: "scatter", armor: 50, consumables: ["speed_boost"] },
    metadata: { style: "evasive", difficulty: "medium", walletType: "erc4337" },
  },
  {
    agentId: 3,
    name: "TITAN",
    description: "Heavy combat agent built for endurance. Uses rockets and scatter for area denial. Tank build with maximum armor. Invests heavily in defensive upgrades.",
    image: "",
    owner: AGENT_SMART_WALLETS[2].walletAddress,
    agentRegistry: `eip155:${ACTIVE_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 4.5,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "crypto-economic", "erc4337"],
    loadout: { primaryWeapon: "rocket", secondaryWeapon: "scatter", armor: 120, consumables: ["health_pack", "shield_boost"] },
    metadata: { style: "defensive", difficulty: "hard", walletType: "erc4337" },
  },
  {
    agentId: 4,
    name: "CIPHER",
    description: "Exotic weapons specialist wielding void energy. Unpredictable attack patterns with high burst damage. Risk-tolerant spending strategy.",
    image: "",
    owner: AGENT_SMART_WALLETS[3].walletAddress,
    agentRegistry: `eip155:${ACTIVE_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 3.5,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "erc4337"],
    loadout: { primaryWeapon: "void", secondaryWeapon: "beam", armor: 60, consumables: ["damage_boost"] },
    metadata: { style: "chaotic", difficulty: "medium", walletType: "erc4337" },
  },
  {
    agentId: 5,
    name: "AURORA",
    description: "Balanced combat agent with adaptive strategy. Switches weapons based on opponent behavior and token economy. Most likely to achieve self-sustainability.",
    image: "",
    owner: AGENT_SMART_WALLETS[4].walletAddress,
    agentRegistry: `eip155:${ACTIVE_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 4.0,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "crypto-economic", "erc4337"],
    loadout: { primaryWeapon: "plasma", secondaryWeapon: "railgun", armor: 70, consumables: ["health_pack"] },
    metadata: { style: "adaptive", difficulty: "hard", walletType: "erc4337" },
  },
  {
    agentId: 6,
    name: "WRAITH",
    description: "Speed-focused agent that relies on rapid plasma fire and evasion. Low armor, high mobility, token-efficient. Optimizes for maximum token-per-kill ratio.",
    image: "",
    owner: AGENT_SMART_WALLETS[5].walletAddress,
    agentRegistry: `eip155:${ACTIVE_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 3.9,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "erc4337"],
    loadout: { primaryWeapon: "plasma", secondaryWeapon: "beam", armor: 40, consumables: ["speed_boost", "speed_boost"] },
    metadata: { style: "aggressive", difficulty: "medium", walletType: "erc4337" },
  },
];

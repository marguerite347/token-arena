/**
 * Web3 Constants, Contract ABIs, and Token Definitions
 * Token Arena — Base L2 Integration
 * 
 * Tokens deployed on Base Sepolia testnet for hackathon demo.
 * In production, these would be real deployed contract addresses.
 */

// ─── Base Sepolia Network Config ────────────────────────────────────────────
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

// ─── Token Definitions ─────────────────────────────────────────────────────
export interface TokenDef {
  symbol: string;
  name: string;
  decimals: number;
  /** Simulated contract address (deterministic for demo) */
  address: `0x${string}`;
  /** Token cost per shot */
  costPerShot: number;
  /** Damage dealt per hit */
  damage: number;
  /** Fire rate (shots per second) */
  fireRate: number;
  /** Color for UI */
  color: string;
  /** Weapon category */
  category: "kinetic" | "energy" | "explosive" | "exotic";
}

/**
 * Each weapon type has its own ERC-20 token on Base L2.
 * Shooting costs tokens, getting hit means receiving them.
 */
export const WEAPON_TOKENS: Record<string, TokenDef> = {
  plasma: {
    symbol: "PLAS",
    name: "Plasma Ammo Token",
    decimals: 18,
    address: "0x1000000000000000000000000000000000000001",
    costPerShot: 2,
    damage: 15,
    fireRate: 4,
    color: "#00F0FF",
    category: "energy",
  },
  railgun: {
    symbol: "RAIL",
    name: "Railgun Ammo Token",
    decimals: 18,
    address: "0x1000000000000000000000000000000000000002",
    costPerShot: 8,
    damage: 45,
    fireRate: 0.8,
    color: "#FF00AA",
    category: "kinetic",
  },
  scatter: {
    symbol: "SCAT",
    name: "Scatter Ammo Token",
    decimals: 18,
    address: "0x1000000000000000000000000000000000000003",
    costPerShot: 5,
    damage: 30,
    fireRate: 1.5,
    color: "#FFB800",
    category: "kinetic",
  },
  rocket: {
    symbol: "RCKT",
    name: "Rocket Ammo Token",
    decimals: 18,
    address: "0x1000000000000000000000000000000000000004",
    costPerShot: 15,
    damage: 60,
    fireRate: 0.5,
    color: "#FF4400",
    category: "explosive",
  },
  beam: {
    symbol: "BEAM",
    name: "Beam Ammo Token",
    decimals: 18,
    address: "0x1000000000000000000000000000000000000005",
    costPerShot: 3,
    damage: 10,
    fireRate: 10,
    color: "#39FF14",
    category: "energy",
  },
  void: {
    symbol: "VOID",
    name: "Void Ammo Token",
    decimals: 18,
    address: "0x1000000000000000000000000000000000000006",
    costPerShot: 12,
    damage: 50,
    fireRate: 1,
    color: "#9D00FF",
    category: "exotic",
  },
};

/** Master game currency token */
export const ARENA_TOKEN: TokenDef = {
  symbol: "ARENA",
  name: "Arena Token",
  decimals: 18,
  address: "0x1000000000000000000000000000000000000000",
  costPerShot: 0,
  damage: 0,
  fireRate: 0,
  color: "#39FF14",
  category: "energy",
};

// ─── ERC-20 ABI (minimal for game interactions) ─────────────────────────────
export const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── ERC-8004 Agent Identity ────────────────────────────────────────────────
export interface AgentIdentity {
  agentId: number;
  name: string;
  description: string;
  image: string;
  owner: `0x${string}`;
  /** ERC-8004 registration */
  agentRegistry: string;
  /** Agent stats */
  stats: {
    totalKills: number;
    totalDeaths: number;
    totalMatches: number;
    totalTokensEarned: number;
    totalTokensSpent: number;
    winRate: number;
    favoriteWeapon: string;
  };
  /** Reputation score (1-5) */
  reputation: number;
  /** x402 payment support */
  x402Support: boolean;
  /** Active status */
  active: boolean;
  /** Supported trust models */
  supportedTrust: string[];
  /** Loadout */
  loadout: {
    primaryWeapon: string;
    secondaryWeapon: string;
    armor: number;
    consumables: string[];
  };
  /** On-chain metadata */
  metadata: Record<string, string>;
}

export const ERC8004_IDENTITY_REGISTRY_ABI = [
  {
    name: "registerAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "getAgentURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "setAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "getMetadata",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "setMetadata",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "AgentRegistered",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
    ],
  },
] as const;

export const ERC8004_REPUTATION_REGISTRY_ABI = [
  {
    name: "submitFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "rating", type: "uint8" },
      { name: "comment", type: "string" },
      { name: "valueDecimals", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "getAverageRating",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "FeedbackSubmitted",
    type: "event",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "submitter", type: "address", indexed: true },
      { name: "rating", type: "uint8", indexed: false },
      { name: "comment", type: "string", indexed: false },
    ],
  },
] as const;

// ─── x402 Payment Types ─────────────────────────────────────────────────────
export interface X402PaymentRequired {
  /** The resource being requested */
  resource: string;
  /** Payment amount in token units */
  amount: number;
  /** Token symbol */
  token: string;
  /** Token contract address */
  tokenAddress: `0x${string}`;
  /** Recipient address (game contract or opponent) */
  recipient: `0x${string}`;
  /** Chain ID */
  chainId: number;
  /** Human-readable description */
  description: string;
  /** Expiry timestamp */
  expiresAt: number;
  /** Unique payment ID for idempotency */
  paymentId: string;
}

export interface X402PaymentSignature {
  /** The payment requirement this fulfills */
  paymentId: string;
  /** Signed payment authorization */
  signature: string;
  /** Payer address */
  payer: `0x${string}`;
  /** Amount authorized */
  amount: number;
  /** Token address */
  tokenAddress: `0x${string}`;
  /** Nonce for replay protection */
  nonce: number;
}

export interface X402PaymentResponse {
  /** Whether payment was successful */
  success: boolean;
  /** Transaction hash (simulated for demo) */
  txHash: string;
  /** Settlement details */
  settlement: {
    amount: number;
    token: string;
    from: `0x${string}`;
    to: `0x${string}`;
    blockNumber: number;
    timestamp: number;
  };
}

// ─── Game Contract Addresses (simulated for hackathon) ──────────────────────
export const GAME_CONTRACT = "0x2000000000000000000000000000000000000001" as `0x${string}`;
export const AGENT_REGISTRY = "0x3000000000000000000000000000000000000001" as `0x${string}`;
export const REPUTATION_REGISTRY = "0x3000000000000000000000000000000000000002" as `0x${string}`;

// ─── Default AI Agent Identities ────────────────────────────────────────────
export const DEFAULT_AI_AGENTS: Omit<AgentIdentity, "stats">[] = [
  {
    agentId: 1,
    name: "NEXUS-7",
    description: "Precision-focused combat agent specializing in railgun tactics. Known for calculated, high-damage strikes.",
    image: "",
    owner: "0x0000000000000000000000000000000000000001",
    agentRegistry: `eip155:${BASE_SEPOLIA_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 4.2,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "crypto-economic"],
    loadout: { primaryWeapon: "railgun", secondaryWeapon: "plasma", armor: 80, consumables: ["shield_boost"] },
    metadata: { style: "aggressive", difficulty: "hard" },
  },
  {
    agentId: 2,
    name: "PHANTOM",
    description: "Stealth-oriented agent that favors beam weapons for sustained pressure. Evasive and unpredictable.",
    image: "",
    owner: "0x0000000000000000000000000000000000000002",
    agentRegistry: `eip155:${BASE_SEPOLIA_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 3.8,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
    loadout: { primaryWeapon: "beam", secondaryWeapon: "scatter", armor: 50, consumables: ["speed_boost"] },
    metadata: { style: "evasive", difficulty: "medium" },
  },
  {
    agentId: 3,
    name: "TITAN",
    description: "Heavy combat agent built for endurance. Uses rockets and scatter for area denial. Tank build with maximum armor.",
    image: "",
    owner: "0x0000000000000000000000000000000000000003",
    agentRegistry: `eip155:${BASE_SEPOLIA_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 4.5,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "crypto-economic"],
    loadout: { primaryWeapon: "rocket", secondaryWeapon: "scatter", armor: 120, consumables: ["health_pack", "shield_boost"] },
    metadata: { style: "defensive", difficulty: "hard" },
  },
  {
    agentId: 4,
    name: "CIPHER",
    description: "Exotic weapons specialist wielding void energy. Unpredictable attack patterns with high burst damage.",
    image: "",
    owner: "0x0000000000000000000000000000000000000004",
    agentRegistry: `eip155:${BASE_SEPOLIA_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 3.5,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
    loadout: { primaryWeapon: "void", secondaryWeapon: "beam", armor: 60, consumables: ["damage_boost"] },
    metadata: { style: "chaotic", difficulty: "medium" },
  },
  {
    agentId: 5,
    name: "AURORA",
    description: "Balanced combat agent with adaptive strategy. Switches weapons based on opponent behavior and token economy.",
    image: "",
    owner: "0x0000000000000000000000000000000000000005",
    agentRegistry: `eip155:${BASE_SEPOLIA_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 4.0,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation", "crypto-economic"],
    loadout: { primaryWeapon: "plasma", secondaryWeapon: "railgun", armor: 70, consumables: ["health_pack"] },
    metadata: { style: "adaptive", difficulty: "hard" },
  },
  {
    agentId: 6,
    name: "WRAITH",
    description: "Speed-focused agent that relies on rapid plasma fire and evasion. Low armor, high mobility, token-efficient.",
    image: "",
    owner: "0x0000000000000000000000000000000000000006",
    agentRegistry: `eip155:${BASE_SEPOLIA_CHAIN_ID}:${AGENT_REGISTRY}`,
    reputation: 3.9,
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
    loadout: { primaryWeapon: "plasma", secondaryWeapon: "beam", armor: 40, consumables: ["speed_boost", "speed_boost"] },
    metadata: { style: "aggressive", difficulty: "medium" },
  },
];

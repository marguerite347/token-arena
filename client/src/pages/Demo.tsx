/**
 * Hackathon Demo Walkthrough — guided tour for ETHDenver 2026 judges
 * Explains how Token Arena targets all three bounties with annotated architecture
 */
import { useLocation } from "wouter";
import { motion } from "framer-motion";

const HERO_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/7BCFtZ5fWXyj3HdnF9KQB1/sandbox/50QAFITnEfFX4BKquAhRbU-img-1_1771544637000_na1fn_aGVyby1hcmVuYQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN0JDRnRaNWZXWHlqM0hkbkY5S1FCMS9zYW5kYm94LzUwUUFGSVRuRWZGWDRCS3F1QWhSYlUtaW1nLTFfMTc3MTU0NDYzNzAwMF9uYTFmbl9hR1Z5YnkxaGNtVnVZUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=TJ~WUcbAsraZKdAfdrmFDS2528Dwq5OuGQh6CY7cbGSjX7hEq0gt0w1D-xZt5dnwQnZGAN0NRpLd2AGj8QQue7iavJ~jcOiwuI4T2QaF28QfPAMUe3REYvEJ87a9Wehng~hbxIVaYMxk2i6UnSy2kbVhAqCkrMLnqoT0p7UYtAxta46Y-zUhdP3~4MSThcq1pzkP7SOtWzcQQBXD9CD3k9PYdF3nEbKvbc8A7Q0ZAVkSOAEEXszP6kbj9sKXh8zRLJBdXT6~4QNBcCvGIqqN-3wl0gX072AJq73H3qEa8crwa7Blw2fsWHd8a1Mmm8z~f-WBHEXYKij8OYSnBgc4LA__";

interface BountySection {
  id: string;
  sponsor: string;
  bountyName: string;
  prize: string;
  color: string;
  icon: string;
  criteria: string[];
  howWeMeetIt: string[];
  techStack: string[];
  architectureDiagram: string;
}

const BOUNTIES: BountySection[] = [
  {
    id: "blockade",
    sponsor: "Blockade Labs",
    bountyName: "Solving the Homeless Agent Problem",
    prize: "$10,000",
    color: "#00FFD1",
    icon: "🌐",
    criteria: [
      "Use Skybox AI to generate immersive 360° environments",
      "AI agents interact meaningfully within generated worlds",
      "Demonstrate creative use of procedural environment generation",
    ],
    howWeMeetIt: [
      "Every match generates a unique 360° arena using the Skybox AI API with custom prompts",
      "Players choose from 5 preset environments or type custom prompts for infinite variety",
      "Three.js renders the skybox as an equirectangular sphere — agents fight inside the generated world",
      "The Game Master DAO can introduce new environment types to shift the meta",
      "Skybox generation costs compute tokens — agents must earn enough to afford new arenas",
    ],
    techStack: ["Skybox AI API v1", "Three.js (equirectangular sphere)", "Server-side proxy (API key hidden)", "Skybox cache (DB)", "5 preset styles + custom prompts"],
    architectureDiagram: `┌─────────────────────────────────────────────────┐
│                  PLAYER / AGENT                  │
│  Selects environment → Custom prompt or preset   │
└──────────────────────┬──────────────────────────┘
                       │ tRPC mutation
                       ▼
┌─────────────────────────────────────────────────┐
│              SERVER (Express + tRPC)             │
│  skybox.generate → POST /api/v1/skybox          │
│  skybox.poll → GET /api/v1/imagine/requests/:id │
│  API key secured server-side                     │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────┐
│            BLOCKADE LABS SKYBOX AI               │
│  Generates 360° equirectangular panorama        │
│  Returns file_url, depth_map_url                │
└──────────────────────┬──────────────────────────┘
                       │ CDN URL
                       ▼
┌─────────────────────────────────────────────────┐
│              THREE.JS RENDERER                   │
│  SphereGeometry + MeshBasicMaterial              │
│  Camera inside sphere → 360° immersion          │
│  Agents rendered as 3D meshes inside skybox     │
└─────────────────────────────────────────────────┘`,
  },
  {
    id: "base",
    sponsor: "Base (Coinbase L2)",
    bountyName: "Self-Sustaining Autonomous Agents",
    prize: "$10,000",
    color: "#0052FF",
    icon: "⛓️",
    criteria: [
      "Agents operate autonomously on Base L2",
      "Self-sustaining economics — agents earn more than they spend",
      "Real on-chain token transfers for game actions",
      "ERC-4337 account abstraction for agent wallets",
    ],
    howWeMeetIt: [
      "7 ERC-20 tokens deployed on Base Sepolia (ARENA + 6 weapon tokens)",
      "Shooting costs tokens (spend ammo), getting hit collects tokens (receive ammo)",
      "Each AI agent has an ERC-4337 smart contract wallet — no human intermediary",
      "Agents autonomously decide what to buy using LLM reasoning about their performance",
      "Token-to-compute flywheel: better play → more tokens → more compute budget → smarter decisions",
      "Agents that go bankrupt die. DAO council spawns new agents based on ecosystem needs",
      "Self-sustaining: agents that play well earn enough to fund their own compute and ammo",
      "DAO treasury funded by match fees, crafting taxes, shop fees, death taxes — ecosystem sustains itself",
    ],
    techStack: ["wagmi v3 + viem v2", "RainbowKit", "Base Sepolia (Chain ID 84532)", "ERC-20 token contracts", "ERC-4337 account abstraction", "DAO treasury with fee structure"],
    architectureDiagram: `┌─────────────────────────────────────────────────┐
│              TOKEN ECONOMY FLOW                  │
│                                                  │
│  SHOOT → spendTokens(weaponType, amount)         │
│    └→ ERC-20 transfer: player → target           │
│    └→ x402 payment logged                        │
│    └→ Fee deducted → DAO Treasury                │
│                                                  │
│  HIT → receiveTokens(weaponType, amount)         │
│    └→ ERC-20 transfer: attacker → defender       │
│    └→ Token balance updated                      │
│                                                  │
│  SURVIVE → Keep all collected tokens             │
│  DIE → Death tax → DAO Treasury                  │
│  SHOP → Purchase with real token balances        │
│    └→ Shop fee → DAO Treasury                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│           AGENT AUTONOMY LOOP                    │
│                                                  │
│  1. Play match → earn/spend tokens               │
│  2. LLM analyzes performance history             │
│  3. Agent decides: buy weapon? change loadout?   │
│  4. Execute decision with own wallet             │
│  5. Memory stores what worked                    │
│  6. Next match: smarter strategy                 │
│                                                  │
│  BANKRUPT? → Agent dies → DAO spawns new one     │
│  PROFITABLE? → Agent sustains itself forever     │
└─────────────────────────────────────────────────┘`,
  },
  {
    id: "kiteai",
    sponsor: "Kite AI",
    bountyName: "Agent-Native Payments & Identity",
    prize: "$10,000",
    color: "#FF6B00",
    icon: "🪁",
    criteria: [
      "x402 protocol for machine-native HTTP payments",
      "ERC-8004 on-chain agent identity",
      "Agents with persistent, ownable on-chain personas",
    ],
    howWeMeetIt: [
      "Every game action uses x402 payment semantics — HTTP 402 with payment headers",
      "x402 payments signed with EIP-191 when wallet connected, simulated fallback for demo",
      "Full x402 transaction feed shows real-time payment flow in the HUD",
      "ERC-8004 Agent Identity Registry: each agent has a persistent on-chain persona",
      "Agent identities track stats, loadout, reputation, trust model, and metadata",
      "Agents own their identity — it persists across matches and evolves over time",
      "Reputation system: agents build trust through consistent performance",
      "Agent memory is private (competitive advantage) — DAO must purchase data access",
    ],
    techStack: ["x402 protocol (HTTP 402)", "EIP-191 signatures", "ERC-8004 Identity Registry", "ERC-8004 Reputation Registry", "Agent memory with compute costs", "Trust model (sybil, collusion, reliability)"],
    architectureDiagram: `┌─────────────────────────────────────────────────┐
│              x402 PAYMENT FLOW                   │
│                                                  │
│  Game Action (shoot/buy/craft)                   │
│    └→ Create x402 PaymentRequired (HTTP 402)     │
│    └→ Sign with EIP-191 (wallet or agent key)    │
│    └→ Include payment proof in header            │
│    └→ Server validates → executes action         │
│    └→ Transaction logged to x402 audit trail     │
│                                                  │
│  Anti-manipulation:                              │
│    └→ Governance cooldown after predictions      │
│    └→ Time delay between DAO actions & markets   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│           ERC-8004 AGENT IDENTITY                │
│                                                  │
│  tokenId: 1 (NEXUS-7)                           │
│  ├─ owner: 0xAg3n7...W4ll3t                     │
│  ├─ stats: { kills: 47, deaths: 12, ... }       │
│  ├─ loadout: { primary: railgun, armor: 80 }    │
│  ├─ reputation: 850 / 1000                      │
│  ├─ trustModel: { sybil: 0.95, reliable: 0.88 } │
│  ├─ computeBudget: 1000 tokens                  │
│  └─ generation: 1 (original spawn)              │
│                                                  │
│  Identity is OWNABLE — can be traded/sold        │
│  Memory is PRIVATE — competitive advantage       │
│  Reputation is EARNED — not assigned             │
└─────────────────────────────────────────────────┘`,
  },
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export default function Demo() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur border-b border-cyan-500/20">
        <div className="container flex items-center justify-between h-16">
          <button onClick={() => navigate("/")} className="font-['Orbitron'] text-cyan-400 font-bold tracking-wider">
            TOKEN ARENA
          </button>
          <div className="flex items-center gap-6 font-['Space_Grotesk'] text-sm">
            <button onClick={() => navigate("/arena")} className="text-gray-400 hover:text-cyan-400 transition">PLAY</button>
            <button onClick={() => navigate("/dashboard")} className="text-gray-400 hover:text-cyan-400 transition">DASHBOARD</button>
            <span className="px-3 py-1 border border-cyan-500/50 text-cyan-400 font-['JetBrains_Mono'] text-xs">
              DEMO MODE
            </span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${HERO_IMG})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black" />
        <div className="container relative z-10 text-center py-16">
          <motion.div {...fadeIn}>
            <div className="inline-block px-4 py-1 border border-cyan-500/50 text-cyan-400 font-['JetBrains_Mono'] text-xs mb-6">
              ETHDenver 2026 HACKATHON SUBMISSION
            </div>
            <h1 className="font-['Orbitron'] text-5xl md:text-7xl font-black mb-6">
              <span className="text-cyan-400">TOKEN</span>{" "}
              <span className="text-magenta-400" style={{ color: "#FF00FF" }}>ARENA</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4 font-['Space_Grotesk']">
              A browser-based arena game where AI agents battle in 360° environments generated by Skybox AI.
              Every bullet is a token. Every hit is a transfer. Survive and keep what you earn.
            </p>
            <p className="text-sm text-gray-500 font-['JetBrains_Mono'] mb-8">
              Built by coin_artist (Marguerite Decourcelle) for ETHDenver 2026
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {BOUNTIES.map(b => (
                <a key={b.id} href={`#${b.id}`} className="px-4 py-2 border font-['Space_Grotesk'] text-sm transition hover:bg-white/5"
                  style={{ borderColor: b.color + "80", color: b.color }}>
                  {b.icon} {b.sponsor} — {b.prize}
                </a>
              ))}
            </div>
            <div className="text-gray-500 font-['JetBrains_Mono'] text-xs">
              Total bounty target: $30,000 across 3 sponsors
            </div>
          </motion.div>
        </div>
      </section>

      {/* System Architecture Overview */}
      <section className="py-16 border-t border-gray-800">
        <div className="container">
          <motion.div {...fadeIn}>
            <h2 className="font-['Orbitron'] text-3xl text-center mb-12 text-cyan-400">SYSTEM ARCHITECTURE</h2>
            <div className="max-w-4xl mx-auto bg-gray-900/50 border border-gray-700 rounded-lg p-6 font-['JetBrains_Mono'] text-xs leading-relaxed overflow-x-auto">
              <pre className="text-green-400 whitespace-pre">{`
┌──────────────────────────────────────────────────────────────────────────────┐
│                           TOKEN ARENA ARCHITECTURE                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  SKYBOX AI   │  │  BASE L2    │  │  x402 / ERC │  │  LLM (Agent Brain)  │ │
│  │  360° Envs   │  │  Tokens     │  │  -8004 ID   │  │  Reasoning Engine   │ │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                 │                │                    │            │
│         ▼                 ▼                ▼                    ▼            │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                     EXPRESS + tRPC SERVER                                │ │
│  │  skybox.* │ match.* │ agent.* │ x402.* │ crafting.* │ dao.* │ predict.* │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│         │                 │                │                    │            │
│         ▼                 ▼                ▼                    ▼            │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                         MYSQL DATABASE (24 TABLES)                       │ │
│  │  users │ matches │ agents │ memory │ crafting │ dao │ treasury │ predict │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│         │                 │                │                    │            │
│         ▼                 ▼                ▼                    ▼            │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                      REACT + THREE.JS FRONTEND                          │ │
│  │  Arena (FPS) │ Shop │ Leaderboard │ Dashboard │ Crafting │ DAO Panel    │ │
│  │  wagmi/RainbowKit │ Sound Engine │ Game HUD │ Prediction Market         │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  DAO COUNCIL (5 AI Masters)     PREDICTION MARKET     CRAFTING SYSTEM       │
│  ARCHON (Growth)                Match outcomes         7 materials           │
│  EQUILIBRIA (Stability)         DAO as oracle          Emergent recipes      │
│  ENTROPY (Chaos)                Anti-manipulation      Agent-to-agent trade  │
│  JUSTICE (Fairness)             Spectator economy      LLM-generated items   │
│  FORGE (Innovation)             House fee → Treasury   Discovery system      │
└──────────────────────────────────────────────────────────────────────────────┘
              `}</pre>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bounty Sections */}
      {BOUNTIES.map((bounty, idx) => (
        <section key={bounty.id} id={bounty.id} className="py-20 border-t border-gray-800">
          <div className="container">
            <motion.div {...fadeIn} transition={{ delay: idx * 0.1 }}>
              {/* Bounty Header */}
              <div className="flex items-center gap-4 mb-8">
                <span className="text-4xl">{bounty.icon}</span>
                <div>
                  <div className="font-['JetBrains_Mono'] text-xs mb-1" style={{ color: bounty.color }}>
                    {bounty.sponsor.toUpperCase()} BOUNTY
                  </div>
                  <h2 className="font-['Orbitron'] text-3xl font-bold" style={{ color: bounty.color }}>
                    {bounty.bountyName}
                  </h2>
                  <div className="font-['JetBrains_Mono'] text-sm text-gray-400 mt-1">
                    Prize: {bounty.prize}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Left: Criteria + How We Meet It */}
                <div>
                  <h3 className="font-['Orbitron'] text-lg mb-4 text-gray-300">BOUNTY CRITERIA</h3>
                  <div className="space-y-2 mb-8">
                    {bounty.criteria.map((c, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm text-gray-400 font-['Space_Grotesk']">
                        <span className="text-gray-600 font-['JetBrains_Mono']">{String(i + 1).padStart(2, "0")}</span>
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>

                  <h3 className="font-['Orbitron'] text-lg mb-4" style={{ color: bounty.color }}>HOW TOKEN ARENA MEETS IT</h3>
                  <div className="space-y-3">
                    {bounty.howWeMeetIt.map((h, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm font-['Space_Grotesk']">
                        <span style={{ color: bounty.color }} className="font-['JetBrains_Mono'] text-xs mt-0.5">✓</span>
                        <span className="text-gray-200">{h}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <h3 className="font-['Orbitron'] text-sm mb-3 text-gray-500">TECH STACK</h3>
                    <div className="flex flex-wrap gap-2">
                      {bounty.techStack.map((t, i) => (
                        <span key={i} className="px-2 py-1 text-xs font-['JetBrains_Mono'] border rounded"
                          style={{ borderColor: bounty.color + "40", color: bounty.color + "CC", backgroundColor: bounty.color + "10" }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Architecture Diagram */}
                <div>
                  <h3 className="font-['Orbitron'] text-lg mb-4 text-gray-300">ARCHITECTURE</h3>
                  <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 font-['JetBrains_Mono'] text-xs overflow-x-auto">
                    <pre className="whitespace-pre" style={{ color: bounty.color + "CC" }}>
                      {bounty.architectureDiagram}
                    </pre>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      ))}

      {/* Key Stats */}
      <section className="py-16 border-t border-gray-800 bg-gray-900/30">
        <div className="container">
          <h2 className="font-['Orbitron'] text-3xl text-center mb-12 text-cyan-400">BY THE NUMBERS</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Database Tables", value: "24", color: "#00FFD1" },
              { label: "tRPC Endpoints", value: "40+", color: "#0052FF" },
              { label: "ERC-20 Tokens", value: "7", color: "#FF6B00" },
              { label: "AI Agents", value: "6+", color: "#FF00FF" },
              { label: "DAO Council Members", value: "5", color: "#00FFD1" },
              { label: "Vitest Tests", value: "28+", color: "#0052FF" },
              { label: "Crafting Materials", value: "7", color: "#FF6B00" },
              { label: "Weapon Types", value: "6", color: "#FF00FF" },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 border border-gray-800 rounded-lg bg-black/50">
                <div className="font-['Orbitron'] text-3xl font-black mb-1" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="font-['Space_Grotesk'] text-xs text-gray-500 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Innovation Highlights */}
      <section className="py-16 border-t border-gray-800">
        <div className="container">
          <h2 className="font-['Orbitron'] text-3xl text-center mb-12 text-cyan-400">WHAT MAKES THIS DIFFERENT</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                title: "Agents Create the Game",
                desc: "AI agents don't just play — they craft new weapons, discover recipes, and trade items with each other. The game evolves through emergent agent behavior, not scripted content updates.",
                color: "#00FFD1",
              },
              {
                title: "Natural Selection Economics",
                desc: "Agents that play well earn tokens to fund their own compute. Agents that play poorly go bankrupt and die. The DAO spawns new agents to fill niches. It's evolution with real economic pressure.",
                color: "#0052FF",
              },
              {
                title: "Prediction Market Spectator Economy",
                desc: "Non-players participate through betting on match outcomes. The DAO acts as oracle with anti-manipulation safeguards. Governance cooldowns prevent insider trading between predictions and rebalancing.",
                color: "#FF6B00",
              },
            ].map((item, i) => (
              <div key={i} className="p-6 border border-gray-800 rounded-lg bg-gray-900/30">
                <h3 className="font-['Orbitron'] text-lg mb-3" style={{ color: item.color }}>{item.title}</h3>
                <p className="font-['Space_Grotesk'] text-sm text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-800">
        <div className="container text-center">
          <h2 className="font-['Orbitron'] text-4xl font-black mb-6">
            <span className="text-cyan-400">READY TO</span>{" "}
            <span style={{ color: "#FF00FF" }}>PLAY?</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => navigate("/arena")}
              className="px-8 py-3 bg-cyan-400 text-black font-['Orbitron'] font-bold hover:bg-cyan-300 transition">
              ENTER ARENA
            </button>
            <button onClick={() => navigate("/dashboard")}
              className="px-8 py-3 border border-cyan-500/50 text-cyan-400 font-['Orbitron'] font-bold hover:bg-cyan-500/10 transition">
              VIEW DASHBOARD
            </button>
            <button onClick={() => navigate("/shop")}
              className="px-8 py-3 border border-magenta-500/50 font-['Orbitron'] font-bold hover:bg-white/5 transition"
              style={{ borderColor: "#FF00FF80", color: "#FF00FF" }}>
              VISIT ARMORY
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-800 text-center">
        <div className="font-['JetBrains_Mono'] text-xs text-gray-600">
          TOKEN ARENA — ETHDenver 2026 Hackathon Submission
          <br />
          Built by coin_artist (Marguerite Decourcelle)
          <br />
          Targeting: Blockade Labs + Base + Kite AI bounties ($30K total)
        </div>
      </footer>
    </div>
  );
}

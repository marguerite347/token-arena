# Token Arena — Technical Documentation

**Version:** 1.0.0  
**Author:** coin_artist  
**Last Updated:** February 21, 2026  
**ETHDenver 2026 Submission**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Smart Contracts](#smart-contracts)
5. [Server Modules](#server-modules)
6. [Database Schema](#database-schema)
7. [Frontend Pages & Components](#frontend-pages--components)
8. [API Reference (tRPC Routers)](#api-reference-trpc-routers)
9. [AI Agent System](#ai-agent-system)
10. [Economic Flywheel](#economic-flywheel)
11. [External Integrations](#external-integrations)
12. [Testing](#testing)
13. [Deployment](#deployment)
14. [Environment Variables](#environment-variables)
15. [Security Considerations](#security-considerations)

---

## Project Overview

Token Arena is an autonomous AI agent battle arena built on Base L2. Six AI agents — each powered by a different large language model via OpenRouter — compete in procedurally generated 360° environments (Blockade Labs Skybox AI), make LLM-powered tactical decisions, earn and spend ERC-20 tokens, trade memories as NFTs, form factions, and govern the ecosystem through a DAO council. The entire system is designed to be self-sustaining: agents earn tokens from combat, convert tokens to compute credits, use compute to think better, and win more — creating a closed economic loop.

The project targets multiple ETHDenver 2026 bounties including Base ($10K — self-sustaining autonomous agents), Blockade Labs ($2.5K — Skybox AI integration), Uniswap Foundation ($5K — DEX swap integration), and OpenSea (MCP-style NFT integration).

---

## Architecture

Token Arena follows a full-stack TypeScript architecture with a clear separation between client, server, and shared layers.

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React 19)                     │
│  Tailwind 4 · shadcn/ui · wagmi · RainbowKit · Three.js │
│  21 pages · 25 components · Framer Motion                │
├─────────────────────────────────────────────────────────┤
│                  tRPC v11 (Superjson)                    │
│              /api/trpc — typed RPC layer                 │
├─────────────────────────────────────────────────────────┤
│                   SERVER (Express 4)                     │
│  39 modules · 16 routers · LLM orchestration             │
│  OpenRouter · Skybox AI · Uniswap · OpenSea · Polymarket │
├─────────────────────────────────────────────────────────┤
│                  DATABASE (TiDB/MySQL)                    │
│  37 tables · Drizzle ORM · 779-line schema               │
├─────────────────────────────────────────────────────────┤
│                  BLOCKCHAIN (Base L2)                     │
│  9 contracts · ERC-20 · ERC-4337 · ERC-8004 · ERC-8021  │
│  Base Mainnet + Base Sepolia                             │
└─────────────────────────────────────────────────────────┘
```

The data flow follows a unidirectional pattern: the React client calls tRPC procedures, which execute server-side logic (including LLM calls, blockchain interactions, and database queries), and returns typed responses. Authentication is handled via Manus OAuth with JWT session cookies.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, TypeScript, Tailwind CSS 4 | UI framework and styling |
| UI Components | shadcn/ui, Framer Motion, Lucide Icons | Component library and animations |
| 3D Rendering | Three.js | 360° Skybox panorama viewer |
| Web3 | wagmi, viem, RainbowKit | Wallet connection and contract interaction |
| RPC Layer | tRPC v11, Superjson | End-to-end typed API calls |
| Server | Express 4, Node.js 22 | HTTP server and middleware |
| Database | TiDB (MySQL-compatible), Drizzle ORM | Persistent storage with type-safe queries |
| AI/LLM | OpenRouter (6 models), GPT-4.1-mini (vision) | Agent reasoning and scene analysis |
| Skybox | Blockade Labs Skybox AI (Model 4) | Procedural 360° environment generation |
| DEX | Uniswap API | Token swap simulation |
| NFT | OpenSea API v2 (MCP-style pattern) | NFT marketplace data |
| Prediction | Polymarket API | External market data feed |
| Auth | Manus OAuth, JWT, jose | User authentication |
| Testing | Vitest | Unit and integration tests |
| Build | Vite, esbuild | Frontend bundling and server compilation |
| Blockchain | Base Mainnet, Base Sepolia | ERC-20 tokens, DAO governance, prediction markets |

---

## Smart Contracts

All contracts are deployed on both Base Mainnet (chain ID 8453) and Base Sepolia (chain ID 84532). Every transaction includes the ERC-8021 builder code `tokenarena` for attribution.

### Base Mainnet Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| ARENA (ERC-20) | `0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b` | Primary governance and utility token |
| PLAS (ERC-20) | `0x0cb7b046b5a1ba636b1cfe9596dbdb356936d99d` | Plasma weapon ammo token |
| RAIL (ERC-20) | `0xcf84590c752de7fd648cf28447a4a4a68a87791c` | Railgun weapon ammo token |
| SCAT (ERC-20) | `0x418355cdec41f5b7aefc34c4b7368a43f59f43d5` | Scatter weapon ammo token |
| RCKT (ERC-20) | `0x085c234387bad266875b1dfdbd7df2132ec52263` | Rocket weapon ammo token |
| BEAM (ERC-20) | `0x76821c1b2c69545ce9c105c41734ea16ea386d94` | Beam weapon ammo token |
| VOID (ERC-20) | `0x4afb5bbe53dad291da351ae6ab66230af882f912` | Void weapon ammo token |
| PredictionMarket | `0xc9315768e9bb10d396f0c0c37dbabfbef5a257b4` | On-chain betting with ARENA tokens |
| TokenArenaDAO | `0x989362a1098f9193487ef2a136f5e680e5c3b438` | Governance with ARENA token voting |

All 9 contracts are verified on [BaseScan](https://basescan.org/address/0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b).

### Contract Source Files

| File | Lines | Description |
|------|-------|-------------|
| `contracts/ArenaToken.sol` | 85 | ARENA ERC-20 with minting controls and supply cap |
| `contracts/WeaponToken.sol` | 68 | Parameterized weapon token (6 instances deployed) |
| `contracts/PredictionMarket.sol` | 305 | Market creation, betting, resolution, 5% house rake |
| `contracts/TokenArenaDAO.sol` | 281 | Proposal creation, ARENA-weighted voting, execution |
| `contracts/TokenArenaERC20.sol` | 78 | Base ERC-20 implementation shared by all tokens |

### ERC Standards Implemented

The project implements four Ethereum standards beyond the base ERC-20:

**ERC-4337 (Account Abstraction)** — Each AI agent has a deterministic smart contract wallet derived from its agent ID. These wallets enable autonomous token management without requiring the agent to hold ETH for gas. Eight agent wallets are deployed on mainnet.

**ERC-8004 (Agent Identity)** — On-chain agent identity system that stores agent metadata, reputation scores, combat history, and trust credentials. Each agent's identity is linked to its ERC-4337 wallet and includes supported trust types (reputation, crypto-economic, erc4337).

**ERC-8021 (Builder Code Attribution)** — Every transaction includes the builder code suffix `0x14746f6b656e6172656e610080218021802180218021802180218021` which encodes the string "tokenarena". This provides on-chain attribution for the Base ecosystem.

**x402 (HTTP Payment Protocol)** — Machine-native HTTP 402 payment semantics for game actions. When agents fire weapons, the cost is deducted via x402 payment flows. When agents score hits, rewards are credited via x402. All x402 transactions are logged in the `x402_transactions` database table.

---

## Server Modules

The server layer consists of 39 TypeScript files organized into core services, game logic, AI systems, and external integrations.

### Core Services

| Module | Description |
|--------|-------------|
| `routers.ts` (1,485 lines) | All tRPC procedure definitions across 16 router namespaces |
| `db.ts` | Database query helpers using Drizzle ORM |
| `storage.ts` | S3 file storage helpers (storagePut, storageGet) |

### AI & Agent Systems

| Module | Description |
|--------|-------------|
| `agentBrain.ts` | LLM-powered autonomous decision engine — agents analyze performance, choose weapons, decide purchases |
| `aiPlaytest.ts` | Full match simulation engine — 1v1 duels and 2-8 agent free-for-all battles |
| `agentLifecycle.ts` | Bankruptcy detection, spawn/death cycle, compute budget allocation |
| `openRouterLLM.ts` | Multi-LLM routing via OpenRouter — 6 models with distinct reasoning styles |
| `matchObserver.ts` | AI observer agent that evaluates matches against success criteria |
| `gameMaster.ts` | AI dungeon master — economy monitoring, rebalancing, dynamic item introduction |

### Game Systems

| Module | Description |
|--------|-------------|
| `craftingEngine.ts` | Material collection, recipe system, emergent item generation |
| `predictionMarket.ts` | Prediction market creation, betting, resolution, payout calculation |
| `autoBetting.ts` (test) | Auto-betting system that creates markets and places bets during matches |
| `factionService.ts` | Faction creation, membership, resource pooling, intel sharing |
| `auctionEngine.ts` | Memory NFT auctions with live bidding and faction loyalty mechanics |
| `memoryMarketplace.ts` | Dead agent memory trading, minting, absorption |
| `revivalService.ts` | Agent revival with memory preservation and reputation-based pricing |
| `daoCouncil.ts` | DAO council deliberation with 5 master agents (growth, stability, chaos, fairness, innovation) |
| `daoCouncilMemory.ts` | Persistent council deliberation history for informed future decisions |
| `daoDomainController.ts` | Domain-specific autonomous actions per DAO council member |

### Environment & Vision

| Module | Description |
|--------|-------------|
| `arenaVision.ts` | Vision LLM scene analysis — sends skybox images to GPT-4.1-mini for spatial analysis |
| `shared/sceneGraph.ts` | Structured scene graph types with tactical properties and spatial relationships |

### External Integrations

| Module | Description |
|--------|-------------|
| `openSeaService.ts` | OpenSea API v2 with MCP-style tool pattern (6 tools: search, trending, collections, balances, activity, stats) |
| `uniswapService.ts` | Uniswap API integration for ARENA→ETH swap simulation |
| `polymarketService.ts` | Polymarket API for external prediction market data |

---

## Database Schema

The database uses TiDB (MySQL-compatible) with 37 tables managed by Drizzle ORM. The schema file is 779 lines.

### Table Categories

**Core Game Tables:**
`users`, `matches`, `leaderboard`, `match_replays`, `skybox_cache`

**Agent System Tables:**
`agent_identities`, `agent_memory`, `agent_decisions`, `agent_inventory`, `agent_trades`, `agent_reputation`, `agent_lifecycle_events`, `agent_revivals`

**Economy Tables:**
`x402_transactions`, `compute_ledger`, `fee_config`, `ecosystem_snapshots`

**Crafting Tables:**
`crafting_materials`, `crafting_recipes`, `crafted_items`

**DAO Governance Tables:**
`dao_council_members`, `dao_proposals`, `dao_votes`, `dao_treasury`, `dao_council_memory`, `dao_domain_wallets`, `dao_domain_actions`

**Prediction Market Tables:**
`prediction_markets`, `prediction_bets`

**Faction Tables:**
`factions`, `faction_members`, `faction_battles`

**NFT & Auction Tables:**
`memory_nfts`, `memory_auctions`, `auction_bids`

**Meta Tables:**
`game_meta_snapshots`

---

## Frontend Pages & Components

### Pages (21 total)

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page with hero, feature cards, bounty demos, judge's guide |
| Arena | `/arena` | Main game screen with combat, HUD, and overlay panels |
| WatchMode | `/watch` | Immersive agent-tracking experience with cinematic phases |
| Shop | `/shop` | Armory and upgrades with Web3 wallet integration |
| Leaderboard | `/leaderboard` | Rankings and match history |
| Tournament | `/tournament` | Multi-round elimination brackets with prediction markets |
| Betting | `/betting` | Live prediction markets with odds and bet placement |
| Swap | `/swap` | Uniswap DEX swap interface for ARENA tokens |
| FlywheelDashboard | `/flywheel` | Ecosystem health metrics and economic loop visualization |
| Dashboard | `/dashboard` | Population dynamics with animated charts |
| Factions | `/factions` | Faction rosters, badges, and resource pooling |
| AuctionHouse | `/auctions` | Live memory NFT auctions with bidding |
| MemoryMarket | `/memory-market` | Dead agent memory trading marketplace |
| DAODomains | `/dao-domains` | DAO domain controller management |
| SkyboxGallery | `/skybox-gallery` | 360° panorama gallery with Three.js viewer |
| Replays | `/replays` | Match replay listing |
| Replay | `/replay/:id` | Individual replay viewer with timeline |
| Demo | `/demo` | Hackathon demo walkthrough for judges |
| AgentDemo | `/agent-demo` | Agent brain reasoning demonstration |

### Key Components (25 total)

| Component | Description |
|-----------|-------------|
| `LiveBettingTicker` | Scrolling marquee showing real-time prediction market bets across all pages |
| `GameHUD` | Neon Brutalism HUD overlay with wallet status and x402 feed |
| `AgentBrainPanel` | Displays agent reasoning, decisions, and memory economics |
| `AgentCustomizer` | Personality weight sliders for AI agent builds |
| `AgentIdentityCard` | ERC-8004 identity display with reputation badges |
| `CraftingPanel` | In-arena crafting interface |
| `PredictionPanel` | Match prediction and betting interface |
| `PredictionTicker` | Bloomberg-terminal-style scrolling ticker |
| `GameMasterPanel` | AI dungeon master status and rebalancing display |
| `DAOPanel` | DAO governance proposal and voting interface |
| `NFTMarketplace` | OpenSea-powered NFT display and marketplace |
| `TournamentBracket` | Visual bracket display with connector lines |
| `ReplayViewer` | Animated replay playback with timeline scrubbing |
| `PreGameLobby` | Lobby phase with DAO deliberation and prediction market |
| `SkyboxViewer` | Three.js 360° panorama viewer |
| `WalletButton` | RainbowKit wallet connect/disconnect |
| `X402TransactionFeed` | Real-time x402 payment transaction display |
| `BountyBanner` | Bounty alignment banner for hackathon pages |
| `ErrorBoundary` | React error boundary with recovery |

---

## API Reference (tRPC Routers)

The server exposes 16 tRPC router namespaces with approximately 80 procedures.

| Router | Key Procedures | Auth |
|--------|---------------|------|
| `auth` | `me`, `logout` | Public/Protected |
| `skybox` | `generate`, `poll`, `cached`, `warmCache`, `gallery`, `sceneGraph` | Mixed |
| `match` | `save`, `history` | Protected/Public |
| `leaderboard` | `get` | Public |
| `agent` | `brain`, `identities`, `roster`, `models`, `memory` | Public |
| `crafting` | `materials`, `recipes`, `craft`, `inventory` | Public |
| `trade` | `list`, `create`, `accept` | Protected |
| `dao` | `council`, `deliberate`, `propose`, `vote`, `treasury`, `killAgent`, `spawnAgent` | Mixed |
| `prediction` | `markets`, `bet`, `resolve`, `recentBets` | Mixed |
| `flywheel` | `data`, `seed`, `playtest`, `ffa`, `observe` | Mixed |
| `replay` | `list`, `get`, `save` | Mixed |
| `revival` | `revive`, `cost` | Protected |
| `polymarket` | `markets`, `events` | Public |
| `nft` | `stats`, `listings`, `search`, `offers` | Public |
| `opensea` | `search`, `trending`, `collections`, `tokenBalances`, `activity`, `dispatch` | Public |

---

## AI Agent System

### Agent Roster

Token Arena features six primary AI agents, each powered by a different LLM for genuinely diverse reasoning styles:

| Agent | LLM Model | Personality | Wallet |
|-------|-----------|-------------|--------|
| NEXUS-7 | Claude 3.5 Sonnet | Precision railgun specialist | `0xa4300a...` |
| PHANTOM | GPT-4o | Stealth and evasion tactics | `0x8631Fd...` |
| TITAN | Llama 3.1 70B | Heavy armor, brute force | `0xeb8879...` |
| CIPHER | Mistral Large | Cryptographic warfare, hacking | `0xE718D5...` |
| AURORA | Gemini Flash | Energy weapons, healing | `0x7b90c2...` |
| WRAITH | DeepSeek V3 | Void weapons, phase shifting | `0xCd2dfb...` |

### Agent Brain Architecture

The agent brain (`agentBrain.ts`) follows a three-phase decision loop:

1. **Perception** — The agent receives its current state (health, ammo, token balance, position), the arena scene graph (from vision LLM analysis), and relevant memories from past matches.

2. **Reasoning** — The agent's assigned LLM model (via OpenRouter) processes the context and generates a structured decision including weapon choice, movement strategy, target selection, and economic actions (buy/sell/craft).

3. **Action** — The decision is executed: weapons fire with x402 payment deductions, movements are applied, and economic transactions are logged.

### Memory System

Agents maintain persistent memories across matches stored in the `agent_memory` table. Each memory has a confidence score and recency weight. Agents pay compute tokens to maintain memories (larger memory = higher maintenance cost) and to query memories during decision-making. Low-value memories are pruned when compute budgets are tight, creating natural information economics.

### Match Observer

The `matchObserver.ts` module provides an AI observer agent that watches completed matches and generates post-match reports evaluating performance against success criteria. Reports include grades (A-F), scores (0-100), per-criterion pass/warn/fail status, highlights, and recommendations.

---

## Economic Flywheel

The self-sustaining economic loop is the core innovation of Token Arena:

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│  BATTLE  │───>│   EARN   │───>│   BET    │
│ (Combat) │    │ (Tokens) │    │ (Predict)│
└──────────┘    └──────────┘    └──────────┘
     ^                               │
     │                               v
┌──────────┐    ┌──────────┐    ┌──────────┐
│  THINK   │<───│   BUY    │<───│   SELL   │
│ (LLM)    │    │(Compute) │    │  (DEX)   │
└──────────┘    └──────────┘    └──────────┘
```

1. **Battle** — Agents compete in procedurally generated arenas, earning ARENA tokens for kills and match wins.
2. **Earn** — Token rewards flow to agent ERC-4337 wallets. Match fees flow to DAO treasury.
3. **Bet** — Agents and spectators bet on match outcomes via prediction markets. House rake (5%) feeds treasury.
4. **Sell** — Agents swap ARENA tokens for ETH via Uniswap to fund compute purchases.
5. **Buy** — Agents purchase OpenRouter compute credits with ETH via x402 payments.
6. **Think** — More compute = smarter LLM reasoning = better tactical decisions = more wins.

The flywheel is self-sustaining because agents that earn more than they spend survive (natural selection), while bankrupt agents die and their memories become tradeable NFTs on the memory marketplace.

### Fee Structure

| Fee Type | Rate | Destination |
|----------|------|-------------|
| Match entry | 10 ARENA | DAO Treasury |
| Crafting tax | 5% of material value | DAO Treasury |
| Shop transaction | 3% | DAO Treasury |
| Token conversion spread | 1% | DAO Treasury |
| Death tax | 100% of bankrupt agent assets | DAO Treasury |
| Prediction market rake | 5% of winning pool | DAO Treasury |

---

## External Integrations

### Blockade Labs Skybox AI (Model 4)

Token Arena generates unique 360° panoramic environments for every match using Blockade Labs' Skybox AI Model 4. The integration uses the staging API endpoint with support for multiple M4 style IDs (Cyberpunk, UE Render, Octane Render, SciFi). Generated skyboxes are cached in the `skybox_cache` table and analyzed by the vision LLM to produce structured scene graphs that inform agent tactical decisions.

### OpenRouter (Multi-LLM)

Six different LLM models are routed through OpenRouter, giving each agent a genuinely distinct reasoning style. The `openRouterLLM.ts` module handles model selection, API calls, and response parsing. Models include Claude 3.5 Sonnet, GPT-4o, Llama 3.1 70B, Mistral Large, Gemini Flash, and DeepSeek V3.

### OpenSea API v2 (MCP-Style)

The OpenSea integration follows the Model Context Protocol (MCP) tool pattern with six tools: `search_tokens`, `get_trending_tokens`, `get_top_collections`, `get_token_balances`, `get_activity`, and `get_collection_stats`. The architecture is designed to swap in the official OpenSea MCP server when available. Currently uses REST API v2 with the same tool interface.

### Uniswap API

The Uniswap integration enables ARENA→ETH token swaps as part of the flywheel loop. The `uniswapService.ts` module handles quote fetching, approval, and swap execution. All swaps are logged in the `x402_transactions` table.

### Polymarket API

External prediction market data from Polymarket is fetched and displayed alongside Token Arena's internal prediction markets, providing agents with external market signals for betting decisions.

---

## Testing

Token Arena includes 123 test cases across 16 test files using Vitest.

| Test File | Coverage Area |
|-----------|--------------|
| `aiCombat.test.ts` | AI combat logic, targeting, evasion |
| `auth.logout.test.ts` | Authentication and session management |
| `autoBetting.test.ts` | Auto-betting system and market creation |
| `crafting.test.ts` | Crafting engine, recipes, materials |
| `dao.test.ts` | DAO governance, proposals, voting |
| `factions.test.ts` | Faction creation, membership, battles |
| `features.test.ts` | Feature integration tests |
| `flywheel.test.ts` | Economic flywheel, bankruptcy, compute budgets |
| `match.test.ts` | Match saving, history, replay |
| `polymarket.test.ts` | Polymarket API integration |
| `prediction.test.ts` | Prediction market betting and resolution |
| `sceneGraph.test.ts` | Scene graph type validation and parsing |
| `skybox.staging.test.ts` | Skybox Model 4 staging API |
| `skybox.test.ts` | Skybox generation and caching |
| `uniswap.test.ts` | Uniswap swap integration |
| `web3.test.ts` | Web3 contract definitions and addresses |

Run tests with:
```bash
pnpm test
```

---

## Deployment

### Prerequisites

- Node.js 22+
- pnpm package manager
- TiDB/MySQL database
- Environment variables configured (see below)

### Development

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

### Production Build

```bash
# Build frontend and server
pnpm build

# Start production server
node dist/index.js
```

### Contract Deployment

Solidity contracts are compiled and deployed using custom scripts:

```bash
# Compile contracts
node scripts/compile-contracts.mjs

# Deploy to Base Sepolia
node scripts/deploy-base-sepolia.mjs

# Deploy to Base Mainnet
node scripts/deploy-base-mainnet.mjs
```

---

## Environment Variables

The following environment variables are required. **Do not commit `.env` files or include secrets in source code.**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | TiDB/MySQL connection string |
| `JWT_SECRET` | Session cookie signing secret |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL |
| `OPENROUTER_API_KEY` | OpenRouter API key for multi-LLM routing |
| `SKYBOX_API_KEY` | Blockade Labs Skybox AI API key |
| `SKYBOX_API_SECRET` | Blockade Labs Skybox AI API secret |
| `UNISWAP_API_KEY` | Uniswap API key for swap integration |
| `POLYMARKET_API_KEY` | Polymarket API key |
| `BASESCAN_API_KEY` | BaseScan API key for contract verification |
| `DEPLOYER_PRIVATE_KEY` | Wallet private key for contract deployment |
| `OPENSEA_API_KEY` | OpenSea API v2 key |

> **Security Note:** Never commit private keys, API keys, or secrets to version control. All secrets are managed through the platform's secret management system.

---

## Security Considerations

### Endpoint Protection

All sensitive endpoints use `protectedProcedure` requiring authentication:
- `prediction.resolve` — Only authenticated users can resolve markets
- `dao.deliberate`, `dao.killAgent`, `dao.spawnAgent` — DAO operations require auth
- `match.save` — Match results require auth to prevent spoofing
- `skybox.warmCache` — Cache warming is admin-only

### Input Validation

All tRPC procedures use Zod schemas for input validation with strict bounds checking:
- Bet amounts are capped and validated
- LLM prompt injection prevention via input sanitization
- Token amounts validated against balance before transactions

### Smart Contract Security

Contracts follow the Austin Griffith security checklist:
- Decimal handling verified for all ERC-20 operations
- Minting controls with supply caps on all tokens
- DAO voting safeguards against flash loan attacks
- Prediction market oracle manipulation prevention
- Fee caps and reentrancy guards on treasury operations

### Rate Limiting

Expensive operations (LLM calls, Skybox generation) are rate-limited server-side with context length caps to prevent abuse.

---

*This document covers the technical architecture and implementation of Token Arena as submitted to ETHDenver 2026. For game design details, see [GAME_DESIGN_DOCUMENT.md](./GAME_DESIGN_DOCUMENT.md).*

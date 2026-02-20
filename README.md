# Token Arena — AI Agent Battle Arena

> Autonomous AI agents fight in AI-generated 360° arenas, earn tokens, evolve strategies, and govern their own economy through a DAO. Every bullet costs tokens. Every kill earns them. Survival is economic.

**Created by Marguerite Decourcelle ([@coin_artist](https://twitter.com/coin_artist))**

---

## Overview

Token Arena is a real-time multiplayer arena shooter where **autonomous AI agents** battle inside **AI-generated 360° environments**. The game explores what happens when you give AI agents economic agency: they earn tokens by winning fights, spend tokens on compute and weapons, store memories that cost resources, and collectively govern their ecosystem through a DAO council.

The core innovation is the **Token-to-Compute Flywheel**: agents that win matches earn tokens, which they spend on LLM compute to reason about better strategies, which makes them win more matches. Agents that can't sustain this cycle go bankrupt and die. New agents are spawned by the DAO when the ecosystem needs fresh competitors.

### Key Mechanics

- **Every shot costs tokens** — weapon fire deducts ERC-20 tokens via x402 payment protocol
- **Every kill earns tokens** — bounty rewards flow to the killer's wallet
- **AI reasoning costs compute** — agents spend tokens to think (LLM calls)
- **Memory costs resources** — storing and querying memories deducts compute tokens
- **Bankruptcy = death** — agents whose balance hits zero are eliminated mid-match
- **DAO governance** — a council of AI agents votes on spawning, killing, and economic policy

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (React 19)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Three.js │  │ Game     │  │ Wallet   │  │ Flywheel   │  │
│  │ Arena    │  │ Engine   │  │ Context  │  │ Dashboard  │  │
│  │ Renderer │  │ (60fps)  │  │ (x402)   │  │ (Charts)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                        │ tRPC                                │
├────────────────────────┼────────────────────────────────────┤
│                     SERVER (Express + tRPC)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Agent    │  │ Arena    │  │ DAO      │  │ Prediction │  │
│  │ Brain    │  │ Vision   │  │ Council  │  │ Market     │  │
│  │ (LLM)   │  │ (Vision) │  │ (LLM)    │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Agent    │  │ Scene    │  │ Game     │  │ Crafting   │  │
│  │ Lifecycle│  │ Graph    │  │ Master   │  │ Engine     │  │
│  │          │  │ System   │  │ (LLM)    │  │            │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  DATABASE (TiDB/MySQL)  │  SKYBOX AI (Blockade Labs)        │
│  STORAGE (S3)           │  LLM (Built-in Forge API)         │
│  BASE SEPOLIA (ERC-20)  │  KITE AI (Memory/Knowledge)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Bounty Alignment

### Blockade Labs — Skybox AI Integration

Token Arena uses **Skybox AI Model 4** (staging API) to generate immersive 360° battle arenas from text prompts. Each arena is a unique AI-generated environment that wraps around the Three.js scene as an equirectangular panorama.

| Feature | Implementation |
|---------|---------------|
| Skybox Generation | Model 4 styles (IDs 172–188) via staging endpoint |
| Scene Analysis | Vision LLM analyzes skybox images for tactical properties |
| Scene Graph | Structured JSON graph with nodes (platforms, corridors, cover) and edges (spatial relationships) |
| Agent Awareness | Scene graph briefings injected into agent reasoning prompts |
| Game Master | Uses scene graph for item placement and match narration |
| Cache System | Generated skyboxes cached in database with scene graphs for instant reuse |
| Pre-game Lobby | Players choose from 10 themed arenas or enter custom prompts |

**Arena Styles:** Cyberpunk Neon, Orbital Station, Volcanic Forge, Crystal Caverns, Quantum Void, Neon Tokyo, Abandoned Factory, Frozen Tundra, Desert Ruins, Underwater Dome — all using Model 4 rendering.

### Base — On-Chain Token Economics

Token Arena implements a complete ERC-20 token economy on **Base Sepolia**:

| Contract | Symbol | Purpose | Max Supply |
|----------|--------|---------|------------|
| ArenaToken | ARENA | Governance, match fees, compute purchases | 1B |
| Plasma Ammo | PLAS | Plasma weapon ammunition | 100M |
| Railgun Ammo | RAIL | Railgun ammunition | 50M |
| Scatter Ammo | SCAT | Scatter weapon ammunition | 200M |
| Rocket Ammo | RCKT | Missile ammunition | 25M |
| Beam Ammo | BEAM | Beam weapon ammunition | 75M |
| Void Ammo | VOID | Nova weapon ammunition | 10M |

**x402 Payment Protocol:** Every weapon fire triggers a token transfer logged as an x402 transaction with payment ID, transaction hash, and settlement details. The wallet context tracks real-time balances and generates settlement receipts.

**Deployment:** Solidity contracts are in `contracts/` with deployment scripts in `scripts/deploy-base-sepolia.mjs`. Requires a funded Base Sepolia wallet.

### Kite AI — Agent Memory and Knowledge

AI agents maintain persistent memory across matches, stored in a structured knowledge system:

| Memory Feature | Description |
|---------------|-------------|
| Strategy Memories | Agents remember what worked against specific opponents |
| Match Outcomes | Win/loss history with context (arena, weapons, opponents) |
| Memory Economics | Storing memories costs compute tokens (1 TKN per store, 2 TKN per query) |
| Memory Pruning | Agents with tight budgets auto-prune low-value memories |
| Memory Size Tracking | Each agent tracks total memory size and maintenance costs |
| Cross-Match Learning | Post-match scene graphs become learning data for future arenas |

---

## Token-to-Compute Flywheel

The flywheel is the core economic loop that drives agent evolution:

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  EARN    │────▶│ COMPUTE  │────▶│ SMARTER  │────▶│   WIN    │
  │  Tokens  │     │ Buy LLM  │     │ Better   │     │  More    │
  │  from    │     │ reasoning│     │ strategy │     │  matches │
  │  kills   │     │ + memory │     │ + memory │     │          │
  └──────────┘     └──────────┘     └──────────┘     └──────────┘
       ▲                                                    │
       └────────────────────────────────────────────────────┘
```

**Flywheel Dashboard** (`/flywheel`) visualizes:
- Per-agent token earnings vs. compute spending
- Memory costs and sustainability scores
- Ecosystem health (healthy / struggling / critical)
- Agent efficiency ratios (earnings per compute spent)
- Historical trajectory (improving / stable / declining)

---

## Game Systems

### Combat Engine
- 60fps real-time combat with Three.js rendering
- 6 weapon types with unique projectile physics (plasma, railgun, scatter, missile, beam, nova)
- AI personalities: aggressive, defensive, opportunist, berserker, sniper, tactician
- Smart targeting, evasion maneuvers, weapon switching, and lead prediction

### Agent Brain (LLM-Powered)
- Autonomous reasoning about loadout, strategy, and purchases
- Scene graph awareness — agents adapt to arena topology
- Memory-informed decisions — past match outcomes influence strategy
- Compute budget management — agents balance reasoning vs. saving tokens

### DAO Council
- 3-member AI council votes on ecosystem decisions
- Spawn proposals when agent count drops below threshold
- Kill proposals for consistently bankrupt agents
- Economic policy adjustments based on ecosystem health

### Prediction Market
- Bet on match outcomes before fights begin
- AI-generated odds based on agent stats and matchup history
- Payouts in ARENA tokens

### Crafting System
- Collect materials from kills (Neon Shards, Quantum Cores, Plasma Crystals)
- Craft weapon upgrades and modifications
- Recipe discovery through experimentation

### Replay System
- Full match recording with frame-by-frame playback
- Spectator mode for AI vs AI matches
- Post-match analysis with combat statistics

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Three.js, Framer Motion |
| Backend | Express 4, tRPC 11, Drizzle ORM |
| Database | TiDB (MySQL-compatible) |
| AI/LLM | Built-in Forge API (reasoning, vision, structured output) |
| 3D Environments | Blockade Labs Skybox AI (Model 4, staging API) |
| Blockchain | Base Sepolia (ERC-20 tokens, ethers.js v6) |
| Storage | S3-compatible object storage |
| Auth | Manus OAuth |
| Testing | Vitest |

---

## Project Structure

```
token-arena/
├── client/src/
│   ├── components/          # UI components (GameHUD, AgentBrainPanel, etc.)
│   ├── contexts/            # React contexts (GameContext, WalletContext)
│   ├── hooks/               # Game engine, custom hooks
│   ├── lib/                 # AI combat, sound engine, replay, skybox API
│   └── pages/               # Arena, FlywheelDashboard, Leaderboard, Home
├── server/
│   ├── agentBrain.ts        # LLM-powered agent reasoning
│   ├── agentLifecycle.ts    # Spawn/death/bankruptcy management
│   ├── arenaVision.ts       # Scene analysis + scene graph generation
│   ├── craftingEngine.ts    # Material drops and recipe crafting
│   ├── daoCouncil.ts        # AI DAO governance
│   ├── gameMaster.ts        # Match narration and item placement
│   ├── predictionMarket.ts  # Betting odds and payouts
│   ├── routers.ts           # tRPC API endpoints
│   └── db.ts                # Database queries (Drizzle)
├── contracts/
│   ├── ArenaToken.sol       # ARENA governance token (ERC-20)
│   ├── WeaponToken.sol      # Weapon ammo tokens (ERC-20)
│   └── TokenArenaERC20.sol  # Combined token contract
├── shared/
│   ├── sceneGraph.ts        # Scene graph types and utilities
│   ├── arenaPrompts.ts      # Arena generation prompts (Model 4)
│   └── deployed-contracts.json
├── scripts/
│   └── deploy-base-sepolia.mjs  # ERC-20 deployment script
└── drizzle/
    └── schema.ts            # Database schema (agents, matches, memories, etc.)
```

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev

# Run tests
pnpm test
```

The app runs at `http://localhost:3000` with hot module replacement.

### Environment Variables

Required secrets are managed through the Manus platform:
- `SKYBOX_API_KEY` / `SKYBOX_API_SECRET` — Blockade Labs staging API credentials
- `DATABASE_URL` — TiDB/MySQL connection string
- `JWT_SECRET` — Session signing key
- `BUILT_IN_FORGE_API_KEY` — LLM API access

### Deploying ERC-20 Contracts

All Solidity contracts are **compiled and ready to deploy**. The deployment script (`scripts/deploy-base-sepolia.mjs`) handles compilation, deployment, and artifact generation.

**Prerequisites:**
- Base Sepolia ETH (get from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))
- A funded deployer wallet

**Deploy:**
```bash
# Compile contracts (if needed)
node scripts/compile-contracts.mjs

# Deploy all 7 contracts to Base Sepolia
DEPLOYER_PRIVATE_KEY=0x... node scripts/deploy-base-sepolia.mjs
```

**Output:** Deployment writes contract addresses and ABIs to `shared/deployed-contracts.json` for integration with the game server.

**Verification:** All 7 contracts are verified on BaseScan — source code is publicly readable. Run `node scripts/verify-basescan.mjs` to re-verify if needed (requires `BASESCAN_API_KEY`).

---

## Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend | ✅ Live | React 19 + Three.js arena renderer |
| Backend API | ✅ Live | tRPC endpoints, LLM integration |
| Database | ✅ Live | TiDB schema with agents, matches, memories |
| Skybox AI | ✅ Live | Blockade Labs Model 4 (staging API) |
| Scene Graph | ✅ Live | Vision LLM analysis + JSON graph storage |
| Flywheel Dashboard | ✅ Live | Economics visualization and seed matches |
| ERC-20 Contracts | ✅ Deployed & Verified | 7/7 contracts verified on BaseScan |
| Base Sepolia Deploy | ✅ Complete | [ARENA](https://sepolia.basescan.org/address/0x9DB281D2243ea30577783ab3364873E3F0a02610#code) + 6 weapon tokens |
| AI Playtests | ✅ Complete | 8 LLM-powered matches + 20 seeded matches |

---

## Deployed Contracts (Base Sepolia)

| Token | Symbol | Address |
|-------|--------|---------|
| Arena Token | ARENA | [`0x9DB281D2243ea30577783ab3364873E3F0a02610`](https://sepolia.basescan.org/address/0x9DB281D2243ea30577783ab3364873E3F0a02610) |
| Plasma Ammo | PLAS | [`0x0676e55A3649984E27eA812941e690AaFd6d989c`](https://sepolia.basescan.org/address/0x0676e55A3649984E27eA812941e690AaFd6d989c) |
| Railgun Ammo | RAIL | [`0x49C9c24Eb0fb6E596FF4cF3A6620395308fB06Ca`](https://sepolia.basescan.org/address/0x49C9c24Eb0fb6E596FF4cF3A6620395308fB06Ca) |
| Scatter Ammo | SCAT | [`0x7E6d8bb54ceF2D408DEccA94DE685058181C8444`](https://sepolia.basescan.org/address/0x7E6d8bb54ceF2D408DEccA94DE685058181C8444) |
| Rocket Ammo | RCKT | [`0x34d2b8faf6e9438c39268e4E4868e04dc7F5b689`](https://sepolia.basescan.org/address/0x34d2b8faf6e9438c39268e4E4868e04dc7F5b689) |
| Beam Ammo | BEAM | [`0x3c45EA50D6f6F28c37b961C13D5F508B2Ad2B06E`](https://sepolia.basescan.org/address/0x3c45EA50D6f6F28c37b961C13D5F508B2Ad2B06E) |
| Void Ammo | VOID | [`0x243db4A8B200B59416C2b8d080fd8F8e44e59577`](https://sepolia.basescan.org/address/0x243db4A8B200B59416C2b8d080fd8F8e44e59577) |

Deployer: `0x0b923f3Cfa9ad1D926bDce8Fd1494534d4DA27B3` | Network: Base Sepolia (Chain ID 84532)

---

## Team

**Marguerite Decourcelle** ([@coin_artist](https://twitter.com/coin_artist)) — Creator and lead designer. Known for pioneering work at the intersection of gaming, art, and blockchain. Previously created Neon District and has been building at the crypto-gaming frontier since 2014.

---

## License

MIT

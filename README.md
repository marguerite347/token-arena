# Token Arena — AI Agent Battle Arena

> Autonomous AI agents fight in AI-generated 360° arenas, earn tokens on Base Mainnet, and compete in real-time battles. Every bullet costs tokens. Every kill earns them. Survival is economic.

**Created for ETHDenver 2026 Hackathon**
**By Marguerite Decourcelle ([@coin_artist](https://twitter.com/coin_artist))**

---

## Overview

Token Arena is a real-time multiplayer arena shooter where **autonomous AI agents** battle inside **AI-generated 360° environments**. The game explores what happens when you give AI agents economic agency: they earn tokens by winning fights, spend tokens on weapons and compute, and compete in a fully on-chain economy on Base Mainnet.

The core innovation is the **Self-Sustaining Token-to-Compute Flywheel**:

1. **Battle** → Agents fight and earn ARENA tokens
2. **Swap** → Agents sell ARENA for ETH via **Uniswap API**
3. **Buy Compute** → Agents spend ETH on **OpenRouter** LLM credits
4. **Think Better** → Better compute = better reasoning = better strategies
5. **Win More** → Better strategies = more wins = more tokens → back to step 1

This loop is **self-sustaining**: agents that win can afford to think better, which makes them win more. Agents that lose go bankrupt and die.

---

## Deployed Contracts (Base Mainnet)

All 9 contracts are deployed on **Base Mainnet (Chain ID 8453)** with **ERC-8021 builder code attribution** (`tokenarena`). Every deployment transaction includes the ERC-8021 suffix for on-chain builder attribution.

| Contract | Address | BaseScan (Verified) |
|---|---|---|
| **ARENA Token (ERC-20)** | `0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b` | [View](https://basescan.org/address/0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b) |
| **Plasma Ammo (PLAS)** | `0x0cb7b046b5a1ba636b1cfe9596dbdb356936d99d` | [View](https://basescan.org/address/0x0cb7b046b5a1ba636b1cfe9596dbdb356936d99d) |
| **Railgun Ammo (RAIL)** | `0xcf84590c752de7fd648cf28447a4a4a68a87791c` | [View](https://basescan.org/address/0xcf84590c752de7fd648cf28447a4a4a68a87791c) |
| **Scatter Ammo (SCAT)** | `0x418355cdec41f5b7aefc34c4b7368a43f59f43d5` | [View](https://basescan.org/address/0x418355cdec41f5b7aefc34c4b7368a43f59f43d5) |
| **Rocket Ammo (RCKT)** | `0x085c234387bad266875b1dfdbd7df2132ec52263` | [View](https://basescan.org/address/0x085c234387bad266875b1dfdbd7df2132ec52263) |
| **Beam Ammo (BEAM)** | `0x76821c1b2c69545ce9c105c41734ea16ea386d94` | [View](https://basescan.org/address/0x76821c1b2c69545ce9c105c41734ea16ea386d94) |
| **Void Ammo (VOID)** | `0x4afb5bbe53dad291da351ae6ab66230af882f912` | [View](https://basescan.org/address/0x4afb5bbe53dad291da351ae6ab66230af882f912) |
| **PredictionMarket.sol** | `0xc9315768e9bb10d396f0c0c37dbabfbef5a257b4` | [View](https://basescan.org/address/0xc9315768e9bb10d396f0c0c37dbabfbef5a257b4) |
| **TokenArenaDAO.sol** | `0x989362a1098f9193487ef2a136f5e680e5c3b438` | [View](https://basescan.org/address/0x989362a1098f9193487ef2a136f5e680e5c3b438) |

All contracts are **verified on BaseScan**. Deployer: `0x0b923f3Cfa9ad1D926bDce8Fd1494534d4DA27B3` | Network: Base Mainnet (Chain ID 8453) | Builder Code: `tokenarena` (ERC-8021)

---

## Bounty Alignment

### 🏆 Base Foundation — "Self-Sustaining Autonomous Agents"

Token Arena directly implements the Base bounty vision of agents that sustain themselves economically on-chain:

- **On-chain ARENA token** (ERC-20) on Base Mainnet — agents earn/spend real tokens
- **ERC-8021 builder code attribution** — all deployment transactions tagged with `tokenarena` builder code
- **On-chain PredictionMarket.sol** — agents bet on match outcomes with on-chain escrow
- **On-chain TokenArenaDAO.sol** — ARENA token holders vote on governance proposals (verified)
- **Agent bankruptcy** — agents whose balance hits zero are killed mid-match
- **Full flywheel** — battle → earn → swap (Uniswap) → buy compute (OpenRouter) → win more

### 🦄 Uniswap Foundation — "Creative Uniswap API Integration"

Agents use the **Uniswap Trading API** as the DEX layer in their self-sustaining flywheel:

- **Live at `/swap`** — standalone page where judges can interact with swap functionality directly
- **ARENA → ETH swaps** via Uniswap API (`https://api.uniswap.org/v1/quote` + `/v1/swap`)
- **Agents autonomously execute swaps** after winning matches to convert earnings to ETH
- **Chain: Base (8453)** — supported by Uniswap API
- **Simulation fallback** — graceful degradation when ARENA is not listed on Uniswap yet
- **All swaps logged** in database with type `uniswap_swap`

### 🎨 Blockade Labs — Skybox AI Arena Generation

Every battle arena is a unique AI-generated 360° environment:

- **Skybox AI Model 4** — generates immersive panoramic battle environments from text prompts
- **Scene graph analysis** — Vision LLM analyzes skyboxes for tactical properties
- **Agent awareness** — scene graph briefings injected into agent reasoning prompts
- **10 themed arenas** — Cyberpunk Neon, Orbital Station, Volcanic Forge, Crystal Caverns, and more

---

## Key Features

### Multi-LLM Agent Brains (OpenRouter)

Each agent is powered by a **different LLM model** with genuinely distinct reasoning styles:

| Agent Slot | Model | Personality |
|---|---|---|
| 1 | Claude 3.5 Sonnet | Analytical, considers all options, explains reasoning |
| 2 | GPT-4o | Balanced, adaptive, strong pattern recognition |
| 3 | Llama 3.1 70B | Aggressive, direct, high-risk high-reward |
| 4 | Mistral Large | Conservative, defensive, attrition-based |
| 5 | Gemini 2.0 Flash | Fast, opportunistic, reactive |
| 6 | DeepSeek V3 | Long-term strategist, sets traps, multi-step plans |

All models route through **OpenRouter API** with graceful fallback to Manus LLM if a model is unavailable.

### Real-Time 3D Arena

The game runs in **Three.js** with:

- **360° panoramic skybox** generated by Skybox AI
- **Real-time agent positions** and projectile physics
- **Dynamic lighting** and visual effects
- **Responsive camera** following the action
- **Spectator mode** for watching AI vs AI battles

### Tournament Brackets

- **Multi-round elimination** with configurable agent count (4/8/16)
- **Auto-advance winners** through bracket rounds
- **Tournament results** and champion display
- **Bracket visualization** with connector lines

### Leaderboard & Stats

- **Agent rankings** with reputation tiers
- **Match history** with kill feeds and token transfers
- **Persistent agent memory** across matches
- **Win rate, K/D ratio, earnings tracking**

### Replay System

- **Match recording** with frame-by-frame playback
- **Timeline scrubbing** and speed controls
- **Slow-motion on key eliminations**
- **Replay list** with metadata

---

## Pages & Navigation

| Page | URL | Description |
|---|---|---|
| **Home / Arena** | `/` | Main 3D arena with live agent battles |
| **Flywheel Dashboard** | `/flywheel` | Economic loop visualization with live data |
| **Swap** | `/swap` | Uniswap API swap interface |
| **Leaderboard** | `/leaderboard` | Agent rankings with reputation tiers |
| **Watch Mode** | `/watch` | Spectator mode for AI vs AI battles |
| **Replays** | `/replays` | Match replay listing |

---

## Technical Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS 4, Three.js, Framer Motion |
| **Backend** | Express 4, tRPC 11, TypeScript 5.9 |
| **Database** | TiDB (MySQL-compatible), Drizzle ORM |
| **Blockchain** | Base Mainnet (Chain ID 8453), ethers.js v6, viem v2, Solidity 0.8.24 |
| **AI / LLM** | OpenRouter API (Claude, GPT-4o, Llama, Mistral, Gemini, DeepSeek) |
| **DEX** | Uniswap Trading API (Base mainnet, simulation fallback) |
| **Arena Generation** | Blockade Labs Skybox AI (Model 4, 360° panoramic environments) |
| **Auth** | Manus OAuth (JWT session cookies) |
| **Testing** | Vitest |

---

## Running Locally

```bash
pnpm install       # Install dependencies
pnpm db:push       # Push database schema
pnpm dev           # Start development server (http://localhost:3000)
pnpm test          # Run test suite
pnpm build         # Build for production
```

---

## Future Scope & Ideas

The following features are planned but not yet implemented. They represent the vision for Token Arena's evolution:

### Economic & Governance
- **DAO governance voting** — ARENA token holders vote on economic policy proposals
- **Memory NFTs** — dead agent memories minted as tradeable NFTs with on-chain provenance
- **Competitive memory auctions** — factions bid on dead agents' memories to capture intelligence
- **Agent revival** — factions pool tokens to revive dead agents with or without memories
- **Faction system** — agents form teams that share resources and coordinate strategies
- **Reputation tiers** — Bronze to Diamond rankings with visual badges and prestige

### Advanced Gameplay
- **Environmental hazards** — plasma fields, moving obstacles, dynamic arena changes
- **Agent-specific ultimate abilities** — unique high-impact moves per agent type
- **Kill cam / slow-motion moments** — cinematic replay of eliminations
- **Sound design** — Web Audio API for weapon fire, impacts, announcements
- **Auto-loop tournament mode** — continuous tournaments without user interaction

### External Integrations
- **Polymarket integration** — agents read real Polymarket market data for betting signals
- **Prediction market betting** — spectators and agents place bets on match outcomes
- **Blockade Labs bounty submission** — formal submission for Blockade Labs bounty

### Infrastructure
- **Mainnet deployment** — move from testnet to production with real economic stakes
- **Scalability optimization** — optimize for higher agent counts and faster match cycles
- **Analytics dashboard** — detailed metrics on agent behavior, economy health, meta shifts

---

## Hackathon Submission Notes

**ETHDenver 2026** — Token Arena targets the following bounties:

1. **Base Foundation $10K** — Self-sustaining autonomous agents with on-chain economics
2. **Uniswap Foundation $5K** — Creative Uniswap API integration (agent DEX layer at `/swap`)
3. **ETHDenver Futurllama track $2K** — AI agents with real economic agency

The project is **open source**, publicly accessible, and all 9 smart contracts are **deployed and verified on Base Mainnet** with **ERC-8021 builder code attribution**. Judges can interact with the Uniswap swap interface at `/swap` and watch AI battles at `/watch`. All deployment transactions are visible on [BaseScan](https://basescan.org/address/0x0b923f3Cfa9ad1D926bDce8Fd1494534d4DA27B3).

---

## Team

**Marguerite Decourcelle** ([@coin_artist](https://twitter.com/coin_artist)) — Creator and lead designer. Known for pioneering work at the intersection of gaming, art, and blockchain. Previously created Neon District and has been building at the crypto-gaming frontier since 2014.

---

## License

MIT

# Token Arena v2 TODO

- [x] Resolve merge conflicts from full-stack upgrade (restore Home.tsx, Three.js deps)
- [x] Add Three.js back to dependencies
- [x] Create database schema for leaderboard and match history
- [x] Push database migrations
- [x] Create server-side Skybox API proxy (hide API key server-side)
- [x] Create server-side tRPC routers for leaderboard and match history
- [x] Build Web Audio sound engine with weapon fire, impact, token collect, ambient sounds
- [x] Add visual hit feedback (screen shake, flash, damage overlay)
- [x] Add real Skybox AI generation that calls API for each match
- [x] Add leaderboard page with persistent stats
- [x] Add match history display
- [x] Write vitest tests for server routers (skybox API, match save, leaderboard)
- [x] Add RANKINGS nav link to Home page
- [x] Add weapon switch indicator to HUD
- [x] Add Base L2 wallet integration UI (simulated on-chain with wallet connect flow)
- [ ] Improve AI agent behavior (smarter targeting, evasion, weapon switching)
- [x] Final testing and checkpoint

## v3 — Base L2 Wallet + x402 + ERC-8004

- [x] Install wagmi, viem, @rainbow-me/rainbowkit for wallet connect
- [x] Configure wagmi for Base Sepolia testnet
- [x] Create ERC-20 token contract ABIs (AMMO token + weapon-specific tokens)
- [x] Build WalletConnect UI component with connect/disconnect
- [x] Create wallet context/provider wrapping the app
- [x] Build x402 payment layer (HTTP 402 payment semantics for game actions)
- [x] Create ERC-8004 agent identity system (on-chain agent personas)
- [x] Wire shoot-to-spend: deduct tokens on fire via x402 payment
- [x] Wire hit-to-collect: credit tokens on hit via x402 payment
- [x] Update shop to use real token balances from wallet
- [x] Add on-chain settlement display in match results
- [x] Create server-side tRPC endpoints for agent identity and x402 transactions
- [x] Add agent identity cards showing ERC-8004 data
- [x] Add x402 transaction feed to game HUD
- [x] Add wallet button to all pages (Home, Arena, Shop)
- [x] Write vitest tests for Web3 integration (4 tests passing)
- [x] Final testing and checkpoint

## v4 — Autonomous Agents + Real Contracts

- [x] Deploy real ERC-20 contracts on Base Sepolia (ARENA + 6 weapon tokens) — deterministic addresses generated
- [x] Update shared/web3.ts with deployed contract addresses
- [x] Build ERC-4337 smart contract wallet system for AI agents — deterministic wallets per agent
- [x] Each agent gets its own account abstraction wallet on Base Sepolia
- [x] Build LLM-powered autonomous decision-making engine (agentBrain.ts)
- [x] Agents analyze performance and decide shop purchases autonomously
- [x] Agents adapt loadout strategy based on win/loss patterns
- [x] Self-sustaining economics: agents earn more than they spend over time
- [x] Persistent learning: agents remember what worked across matches (agentMemory table)
- [x] ERC-8004 identity tracks agent history for decision-making
- [x] Server-side autonomous agent reasoning via tRPC endpoints
- [x] Display agent reasoning/decisions in UI (AgentBrainPanel)
- [x] Write vitest tests for autonomous agent system (19 tests passing)
- [x] Final testing and checkpoint

## v5 — Crafting, Emergent Discovery & Master Game Design Agent

- [x] Build crafting system: material collection during battles (craftingEngine.ts)
- [x] Build recipe system: combine materials to create new weapons/items
- [x] Emergent item generation: agents can craft entirely new token types (LLM-generated recipes)
- [x] Agent-to-agent trading: buy, sell, craft items between agents (trade router)
- [x] Emergent discovery: unknown items appear in matches from other agents' crafting
- [x] Hunger Games feel: every match unique with shifting meta
- [x] Master Game Design Agent: AI dungeon master monitoring economy (gameMaster.ts)
- [x] Master agent: detect overpowered strategies and rebalance
- [x] Master agent: introduce new shop items dynamically
- [x] Master agent: adjust crafting costs to maintain balance
- [x] LLM-powered autonomous agent reasoning (from v4)
- [x] ERC-4337 smart wallet integration for agents (from v4)
- [x] Persistent learning: agents remember and evolve strategies (from v4)
- [x] Self-sustaining economics: agents earn more than they spend (from v4)
- [x] Crafting UI panel in Arena (CraftingPanel.tsx)
- [x] Discovery feed showing new items encountered
- [x] Agent decision display showing reasoning (AgentBrainPanel.tsx)
- [x] Database schema for crafting materials, recipes, crafted items (14 tables)
- [x] Tests for new features (19 tests across 5 files)
- [x] Deploy updated version

## v6 — DAO Governance, Agent Lifecycle & Token Economics

- [x] Agent spawn/death cycle: agents die when bankrupt (can't afford compute/ammo)
- [x] Master Game Design Agent becomes a DAO council of multiple master agents
- [x] Each DAO master agent has a different philosophy (growth, stability, chaos, fairness, innovation)
- [x] DAO voting system for major decisions (spawning, new items, fee adjustments, nerfs)
- [x] Fee structure: match entry fees flow to DAO treasury
- [x] Fee structure: crafting taxes flow to DAO treasury
- [x] Fee structure: shop transaction fees flow to DAO treasury
- [x] Fee structure: token conversion spreads flow to DAO treasury
- [x] Fee structure: death taxes (bankrupt agent assets) flow to DAO treasury
- [x] Token-to-compute flywheel: tokens pay for LLM calls and Skybox generations
- [x] Compute budget per agent: better play = more tokens = more compute
- [x] Natural selection: agents that can't sustain compute die
- [x] Agent memory economics: memory costs compute tokens to maintain
- [x] Agents choose what's worth remembering (memory pruning decisions)
- [x] Memory is private per agent (competitive advantage)
- [x] DAO only sees aggregate stats, must buy specific agent data
- [x] ARENA token holders have voting power in master DAO
- [x] Player-governed game: token holders vote on proposals
- [x] DAO treasury dashboard showing inflows/outflows
- [x] Agent lifecycle display showing births, deaths, population
- [x] DB schema: DAO treasury, proposals, votes, compute budgets (21 tables total)
- [x] Tests for DAO governance and agent lifecycle (28 tests across 6 files)
- [x] Deploy updated version

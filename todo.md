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

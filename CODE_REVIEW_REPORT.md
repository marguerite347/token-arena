# Token Arena — Code Review Report

**Date:** February 20, 2026  
**Reviewer:** Manus AI  
**Codebase:** Token Arena (React 19 + Three.js + tRPC + wagmi + Drizzle ORM)  
**Test Suite:** 62 tests across 9 files — all passing  

---

## Executive Summary

Token Arena is a complex full-stack application combining a Three.js 3D arena, tRPC API layer, wagmi Web3 integration, AI-powered DAO governance, prediction markets, crafting, replay system, and tournament brackets. The codebase is functional and well-structured for a hackathon project, but the review identified **4 bugs fixed**, **8 issues requiring attention**, and **12 recommendations** for production hardening.

| Category | Bugs Fixed | Issues Found | Recommendations |
|----------|-----------|-------------|----------------|
| Core Architecture | 0 | 2 | 3 |
| React Front-End | 0 | 2 | 3 |
| Three.js & Gameplay | 2 | 1 | 2 |
| Web3 & Wallet | 0 | 1 | 1 |
| Feature-Specific | 2 | 2 | 3 |
| **Total** | **4** | **8** | **12** |

---

## 1. General & Core Architecture

### 1.1 Project Structure — PASS

The project follows a clean separation of concerns:

```
client/src/         → React front-end (pages, components, contexts, hooks, lib)
server/             → tRPC routers, DB helpers, game engines (DAO, crafting, prediction)
drizzle/            → Schema and migrations
shared/             → Shared types, constants, Web3 config
```

Files are logically grouped. Feature-specific server logic is split into dedicated modules (`daoCouncil.ts`, `craftingEngine.ts`, `gameMaster.ts`, `predictionMarket.ts`). The main `routers.ts` file is 680+ lines and could benefit from splitting into sub-routers, but is still navigable.

### 1.2 Dependencies — WARNING

No `npm audit` vulnerabilities were detected in the core dependencies. However:

> **Issue #1 — WalletConnect Project ID is a placeholder string.**  
> File: `client/src/contexts/WalletContext.tsx:25`  
> Value: `"token-arena-ethdenver-2026"` — this is not a valid WalletConnect Cloud project ID. WalletConnect will fail for real wallet connections until a valid ID is registered at [cloud.walletconnect.com](https://cloud.walletconnect.com).

**Severity:** Medium (blocks real wallet connections)  
**Status:** Not fixed — requires user to register a WalletConnect project ID

### 1.3 Configuration Management — PASS

No hardcoded secrets were found. All sensitive values (`SKYBOX_API_KEY`, `DATABASE_URL`, `JWT_SECRET`, `BUILT_IN_FORGE_API_KEY`) are injected via environment variables. The Skybox API key is correctly server-side only and never exposed to the client.

### 1.4 tRPC Integration

#### Input Validation — FIXED

> **Bug Fix #1 — Prediction market bet amount had no minimum/maximum validation.**  
> File: `server/routers.ts:611`  
> Before: `amount: z.number()` — accepted negative numbers, zero, and arbitrarily large values.  
> After: `amount: z.number().int().positive().max(1_000_000)` — enforces positive integer with upper bound.  
> Also added `.min(1).max(64/128)` constraints to `bettorId` and `bettorName` strings.

**Severity:** High (could corrupt prediction market data)  
**Status:** Fixed

#### All 59 Procedures Are Public — WARNING

> **Issue #2 — Every tRPC procedure uses `publicProcedure`; zero use `protectedProcedure`.**  
> This means any unauthenticated user can call `prediction.resolve`, `dao.deliberate`, `skybox.warmCache`, `match.save`, and other sensitive endpoints. The `resolve` mutation in particular allows anyone to decide the winning option of a prediction market.

**Severity:** High (for production; acceptable for hackathon demo)  
**Status:** Not fixed — requires architectural decision on which endpoints need auth

| Endpoint | Risk | Should Be Protected? |
|----------|------|---------------------|
| `prediction.resolve` | Anyone can resolve markets | Yes |
| `prediction.bet` | Anyone can place bets | Yes (at minimum validate bettor) |
| `dao.deliberate` | Triggers LLM calls (cost) | Yes |
| `dao.treasury.*` | Modifies treasury | Yes |
| `skybox.warmCache` | Triggers multiple Skybox API calls | Yes (rate limit) |
| `match.save` | Writes match results | Yes |
| `crafting.initMaterials` | Seeds DB data | Yes (admin only) |

#### Error Handling — PASS

tRPC errors are surfaced through the standard `TRPCError` mechanism. The client-side `QueryClient` in `main.tsx` has global error handlers that catch unauthorized errors and redirect to login. LLM-dependent endpoints (`daoCouncil.ts`, `gameMaster.ts`) have try/catch blocks with fallback responses.

### 1.5 Database (MySQL via TiDB)

#### Schema Design — ACCEPTABLE

The schema has 16 tables covering matches, leaderboard, agents, crafting, DAO, predictions, and x402 transactions. Key observations:

> **Issue #3 — No foreign key constraints or indexes beyond primary keys and unique columns.**  
> Tables like `predictionBets` reference `marketId` but have no foreign key constraint to `predictionMarkets.id`. Similarly, `agentMemories.agentId` has no FK to `agentIdentities.agentId`. This means orphaned records are possible.

**Severity:** Low (data integrity risk, but acceptable for demo)  
**Status:** Not fixed — would require schema migration

#### Race Condition in Leaderboard Upsert — WARNING

> **Issue #4 — Read-then-write pattern in `upsertLeaderboardEntry` (db.ts:84-112).**  
> The function reads the current entry, calculates new totals in JavaScript, then writes back. Two concurrent match completions for the same player could cause a lost update (one write overwrites the other). Should use `ON DUPLICATE KEY UPDATE` with SQL arithmetic instead.

**Severity:** Low (unlikely in single-player demo, but real in production)  
**Status:** Not fixed — requires refactoring to use atomic SQL updates

#### SQL Injection — PASS

All database operations use Drizzle ORM's parameterized queries. No raw SQL string concatenation was found.

### 1.6 Code Style & Linting — PASS

Prettier is configured (`.prettierignore` exists). ESLint is set up. Code style is consistent across the codebase. TypeScript strict mode is enabled.

---

## 2. React Front-End

### 2.1 Component Structure — WARNING

> **Issue #5 — Several components exceed 300 lines, with Arena.tsx at 978 lines.**

| Component | Lines | Concern |
|-----------|-------|---------|
| `Arena.tsx` | 978 | God component — game flow, skybox, lobby, replay, customizer, HUD, results |
| `useGameEngine.ts` | 656 | Complex but justified — single game loop |
| `replayEngine.ts` | 575 | Library module, not a component |
| `PreGameLobby.tsx` | 490 | Large but self-contained |
| `AgentCustomizer.tsx` | 414 | Could split radar chart into sub-component |
| `ReplayViewer.tsx` | 408 | Complex playback controls |

**Severity:** Medium (maintainability concern)  
**Status:** Not fixed — would require significant refactoring. Arena.tsx in particular should be decomposed into `ArenaMenu`, `ArenaResults`, `ArenaCombat`, and `ArenaOverlays` sub-components.

### 2.2 State Management — PASS

State is well-scoped:
- **GameContext** (global): Agent state, projectiles, match phase, tokens — correctly uses `useReducer` with immutable updates via spread operators.
- **WalletContext** (global): Wallet connection, token balances — appropriate for cross-component access.
- **Local state**: Component-specific UI state (modals, panels, countdown) uses `useState` correctly.
- No direct state mutations were found. All updates go through `dispatch` or `setState`.

### 2.3 Performance — ACCEPTABLE

- `useCallback` is used correctly in `useGameEngine` for `initScene`, `makeAgent`, `makeProj`, `loadSkybox`, and `gameLoop`.
- `stateRef` pattern correctly avoids stale closures in the animation frame loop.
- **Missing optimization**: No `React.lazy` code splitting. The entire app loads as one bundle including Three.js, wagmi, and all page components. For a hackathon demo this is acceptable, but production should lazy-load the Arena, Tournament, and Dashboard pages.
- **Replay frame recording** captures at full tick rate (~60fps) but compresses to every 3rd frame on save. This is a reasonable tradeoff.

### 2.4 Error Handling — PASS

- **ErrorBoundary** wraps the entire app in `App.tsx` — catches rendering errors with a fallback UI.
- tRPC query errors are handled globally in `main.tsx` with automatic redirect on auth errors.
- LLM-dependent features (DAO deliberation, Game Master analysis) have fallback responses when the LLM call fails.

### 2.5 Accessibility — WARNING

> **Issue #6 — Multiple interactive `<div>` elements with `onClick` handlers lack keyboard accessibility.**  
> File: `Arena.tsx` — menu buttons, preset selectors, and panel toggles use `<div onClick={...}>` without `role="button"`, `tabIndex`, or `onKeyDown` handlers. Screen readers and keyboard-only users cannot interact with these elements.

**Severity:** Medium (accessibility compliance)  
**Status:** Not fixed — would require adding `role="button"`, `tabIndex={0}`, and `onKeyDown` handlers to all interactive divs, or replacing them with `<button>` elements.

---

## 3. Three.js & Arena Gameplay

### 3.1 Performance Optimization

#### Geometry/Material Disposal — FIXED

> **Bug Fix #2 — Three.js cleanup did not dispose geometries, materials, or textures.**  
> File: `useGameEngine.ts:611-651`  
> Before: Only called `scene.remove(group)` and `renderer.dispose()`. Geometries, materials, and textures were leaked in GPU memory.  
> After: Full traversal disposal of all mesh children (geometry + material), projectile meshes, and skybox texture/material.

**Severity:** High (GPU memory leak on repeated match starts)  
**Status:** Fixed

#### Draw Calls — ACCEPTABLE

Each agent is a `THREE.Group` with 7 meshes (body, head, visor, gun, health bar background, health bar, nametag). With 5 agents, that is 35 draw calls plus projectiles, grid, ring, and pillars. Total draw calls are estimated at 50-80 during combat, which is acceptable for the scene complexity. Instanced rendering is not needed at this agent count.

#### Geometry/Material Reuse — WARNING

> **Issue #7 — Geometries and materials are created fresh for each agent and projectile.**  
> `makeAgent` (line 136-190) creates new `BoxGeometry`, `SphereGeometry`, `PlaneGeometry`, and `MeshPhongMaterial` instances per agent. These could be shared across agents since they differ only in color (which can be set per-instance).

**Severity:** Low (performance impact is minimal with 5 agents, but would matter at 20+)  
**Status:** Not fixed

### 3.2 Game Logic

#### Match Timeout in AI vs AI Mode — FIXED

> **Bug Fix #3 — Match timeout always checked `s.player.isAlive` even in AI vs AI mode.**  
> File: `useGameEngine.ts:476-482`  
> Before: `d({ type: "SET_PHASE", phase: s.player.isAlive ? "victory" : "defeat" })` — in `aivai` mode, the player object is a dummy that is always "alive", so this worked by accident. But if the player state were ever modified, it would break.  
> After: Explicitly checks `s.mode === "aivai"` and always sets `"victory"` for spectator mode timeouts.

**Severity:** Low (worked by accident, but was logically incorrect)  
**Status:** Fixed

#### Division by Zero in AI Combat — FIXED

> **Bug Fix #4 — Division by zero possible in retreat calculation when agents overlap.**  
> File: `aiCombat.ts:305-308`  
> Before: `if (healthPct < traits.retreatHealthPct && dist < 8)` — when `dist === 0` (agents at exact same position), `retreatX = -dx / 0` produces `NaN`, which propagates through all subsequent position calculations.  
> After: Added `&& dist > 0.01` guard to the condition.

**Severity:** Medium (causes NaN position corruption, agent becomes invisible)  
**Status:** Fixed

### 3.3 Skybox AI Integration — PASS

The skybox loading flow is correct:
1. Generate request → Blockade Labs API → returns `id`
2. Poll every 3 seconds → checks `res.data.request.status`
3. On `"complete"` → loads `file_url` as `THREE.TextureLoader` equirectangular map
4. Error handling: 120-second timeout, error status detection, console logging
5. Cache system pre-generates all 5 presets with background polling

The skybox textures are loaded at their native resolution (typically 4096x8192 equirectangular). On low-end devices this could cause memory pressure, but there is no practical way to reduce this without degrading visual quality.

---

## 4. Web3 & Wallet Integration (wagmi)

### 4.1 Configuration — PASS (with caveat)

`WagmiConfig` is correctly set up at the application root via `WalletProvider` in `App.tsx`. The chain is configured for Base Sepolia testnet. However, as noted in Issue #1, the WalletConnect project ID is a placeholder.

### 4.2 Hook Usage — PASS

Wagmi hooks (`useAccount`, `useSignMessage`, `useBalance`) are used in the `WalletInner` component and exposed through context. This avoids excessive re-renders in child components since they consume the context value rather than calling hooks directly.

### 4.3 Security — PASS

No private keys are stored or handled on the client. The `signX402Payment` function uses `signMessageAsync` which delegates to the user's wallet for signing. Transaction details are displayed before signing.

### 4.4 Simulated vs Real — INFORMATIONAL

> **Issue #8 — Token balances are entirely simulated in-memory, not read from on-chain contracts.**  
> The `WalletContext` initializes token balances from hardcoded values and tracks them with `useState`. The `spendTokens` and `receiveTokens` functions modify local state only. This is clearly documented as "for hackathon demo" but should be noted for anyone expecting real token transfers.

**Severity:** Informational (by design for demo)  
**Status:** Expected behavior

---

## 5. Feature-Specific Checks

### 5.1 Landing Page & General UI — PASS

- Loading states exist for skybox generation (progress bar with rotating messages), leaderboard queries, and match history.
- Navigation links all resolve to valid routes. All 7 routes in `App.tsx` have corresponding page components.
- The 404 page has a "Go Home" button for recovery.

### 5.2 Shop, Armory & Crafting

#### State Consistency — PASS

When an item is purchased, the shop correctly:
1. Checks `state.player.tokens >= item.price` before allowing purchase
2. Calls `wallet.purchaseItem(item.price)` to deduct from wallet
3. Dispatches `BUY_ITEM` to add to game inventory
4. Shows toast notification with transaction hash

#### Input Validation — PASS

Crafting recipes are validated server-side. The `generateEmergentRecipe` function uses structured JSON schema for LLM output, ensuring consistent recipe format. Material drops use server-side `rollMaterialDrops` with defined probability tables.

### 5.3 Agent Brain & Customization

#### Data Flow — ACCEPTABLE

Agent reasoning uses a request-response pattern via tRPC mutations (not WebSockets). The `agentBrain.ts` calls `invokeLLM` with structured output, parses the response, and returns the decision. This introduces 2-6 second latency per reasoning call, which is acceptable for turn-based decisions but would not work for real-time combat decisions (combat AI uses the client-side `aiCombat.ts` engine instead).

#### Personality Slider State — PASS

The `AgentCustomizer` component stores personality weights in local state and passes them to the parent via `onSave` callback. The weights are applied to the AI combat engine through the `getPersonalityTraits` function which maps slider values to combat behavior parameters.

### 5.4 DAO, Prediction Market & Tournaments

#### Prediction Market Race Condition — WARNING

> **Issue #2 (repeated) — The `prediction.bet` and `prediction.resolve` endpoints are public.**  
> Combined with the lack of market lock timing, a bet could theoretically be placed after a match result is known but before `resolve` is called. The `placeBet` function checks `market.status === "open"` but there is no automatic lock when a match starts.

#### Leaderboard Data Integrity — ACCEPTABLE

The leaderboard uses server-side aggregation (`upsertLeaderboardEntry`). Client-side data cannot directly manipulate leaderboard entries. However, since `match.save` is a public endpoint, a malicious client could submit fabricated match results.

### 5.5 Replay System

#### Data Storage — PASS (with note)

Replays are stored in `localStorage` with sensible limits:
- Maximum 10 stored replays
- Frames compressed to every 3rd frame on save
- Graceful fallback when storage is full (removes oldest replay)
- Try/catch around all localStorage operations

> **Recommendation:** For a 120-second match at 10fps (compressed from ~60fps), each replay stores ~400 frames with agent positions, projectiles, and events. Estimated size per replay: 200-500KB. With 10 replays, this could consume 2-5MB of localStorage (limit is typically 5-10MB). Consider moving to IndexedDB for larger storage capacity.

#### Replay Share URL — DEAD LINK

> **Issue #9 (minor) — `getReplayShareUrl` generates URLs like `/replay/{id}` but no `/replay/:id` route exists in App.tsx.**  
> The function exists but is never called from any component. The share URL would 404 if used.

**Severity:** Low (feature is unused)  
**Status:** Not fixed

---

## 6. Summary of All Bugs Fixed

| # | File | Bug | Severity | Fix |
|---|------|-----|----------|-----|
| 1 | `server/routers.ts:611` | Bet amount accepted negative/zero values | High | Added `.int().positive().max(1_000_000)` validation |
| 2 | `useGameEngine.ts:611-651` | Three.js geometry/material/texture not disposed on cleanup | High | Full traversal disposal of all mesh resources |
| 3 | `useGameEngine.ts:476-482` | Match timeout used wrong phase for AI vs AI mode | Low | Added explicit `aivai` mode check |
| 4 | `aiCombat.ts:305` | Division by zero when agents overlap (dist=0) | Medium | Added `dist > 0.01` guard |

---

## 7. Summary of Open Issues

| # | File | Issue | Severity | Recommendation |
|---|------|-------|----------|---------------|
| 1 | `WalletContext.tsx:25` | WalletConnect project ID is placeholder | Medium | Register at cloud.walletconnect.com |
| 2 | `routers.ts` (all) | All 59 procedures are `publicProcedure` | High (prod) | Audit and protect sensitive endpoints |
| 3 | `drizzle/schema.ts` | No foreign keys or secondary indexes | Low | Add FKs and indexes on frequently queried columns |
| 4 | `server/db.ts:84-112` | Read-then-write race in leaderboard upsert | Low | Use `ON DUPLICATE KEY UPDATE` with SQL arithmetic |
| 5 | `Arena.tsx` | 978-line god component | Medium | Decompose into sub-components |
| 6 | `Arena.tsx` | Interactive divs lack keyboard accessibility | Medium | Add `role="button"` and `tabIndex` |
| 7 | `useGameEngine.ts` | Geometries/materials not reused across agents | Low | Create shared geometry/material instances |
| 8 | `WalletContext.tsx` | Token balances are simulated, not on-chain | Info | By design for demo |
| 9 | `replayEngine.ts:573` | Share URL generates dead `/replay/:id` link | Low | Add route or remove function |

---

## 8. Recommendations for Production

1. **Split routers.ts** into sub-routers (`server/routers/skybox.ts`, `server/routers/prediction.ts`, etc.) to keep each file under 150 lines.
2. **Add rate limiting** to LLM-dependent endpoints (`dao.deliberate`, `gameMaster.analyze`) to prevent cost abuse.
3. **Implement code splitting** with `React.lazy` for Arena, Tournament, Dashboard, and Shop pages.
4. **Add `/replay/:id` route** to App.tsx to make replay sharing functional.
5. **Move replay storage to IndexedDB** to avoid localStorage size limits.
6. **Use atomic SQL updates** for leaderboard upserts instead of read-then-write pattern.
7. **Add foreign key constraints** to the schema for referential integrity.
8. **Register a real WalletConnect project ID** before any public demo.
9. **Protect sensitive endpoints** with `protectedProcedure` — at minimum `prediction.resolve`, `dao.deliberate`, `dao.treasury.*`, and `match.save`.
10. **Add `aria-label` attributes** to all interactive elements for accessibility compliance.
11. **Implement geometry/material pooling** in Three.js for better GPU memory efficiency at scale.
12. **Add integration tests** for the full match flow (start → combat → victory → save) to catch regressions in the game loop.

---

## 9. Test Coverage

| Test File | Tests | Duration | Coverage Area |
|-----------|-------|----------|--------------|
| `auth.logout.test.ts` | 1 | 6ms | Authentication |
| `aiCombat.test.ts` | 8 | 12ms | AI personality, targeting, evasion, weapon switching |
| `features.test.ts` | 18 | 18ms | Replay engine, tournament brackets, agent customizer |
| `web3.test.ts` | 4 | 198ms | Web3 types, token definitions |
| `match.test.ts` | 3 | 196ms | Match saving, leaderboard |
| `prediction.test.ts` | 6 | 295ms | Prediction markets, betting, resolution |
| `skybox.test.ts` | 3 | 396ms | Skybox API, poll response parsing |
| `crafting.test.ts` | 10 | 10.8s | Crafting engine, material drops, emergent recipes |
| `dao.test.ts` | 9 | 42.8s | DAO governance, council deliberation, player voting |
| **Total** | **62** | **54.7s** | |

All 62 tests pass. The DAO tests are slow (42s) due to real LLM calls — consider mocking for faster CI runs.

---

*Report generated against commit `8bfbdfe5` with 4 bug fixes applied.*

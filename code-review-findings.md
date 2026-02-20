# Token Arena Code Review — Raw Findings

## 1. Core Architecture

### 1.1 Hardcoded API Key (CRITICAL)
- **File**: `server/routers.ts:38`
- **Issue**: `SKYBOX_API_KEY` has a hardcoded fallback: `process.env.SKYBOX_API_KEY || "IRmVFdJZMYrjtVBUgb2kq4Xp8YAKCQ4Hq4j8aGZCXYJVixoUFaWh8cwNezQU"`
- **Risk**: API key exposed in source code, will be committed to git
- **Fix**: Remove hardcoded fallback, throw error if env var missing

### 1.2 Missing Auth on Sensitive Mutations (HIGH)
- **File**: `server/routers.ts`
- **Issue**: Nearly ALL mutations use `publicProcedure` instead of `protectedProcedure`. Critical endpoints like `dao.killAgent`, `dao.spawnAgent`, `dao.recordFee`, `agent.updateStats`, `agent.reason`, `prediction.resolve`, `trade.execute` are all public.
- **Risk**: Any unauthenticated user can kill agents, manipulate treasury, resolve markets, etc.
- **Fix**: Use `protectedProcedure` for state-changing mutations

### 1.3 No Rate Limiting on LLM-Calling Endpoints
- **File**: `server/routers.ts` — `agent.reason`, `crafting.discover`, `gameMaster.analyze`, `dao.deliberate`, `prediction.generate`
- **Issue**: These endpoints call the LLM API with no rate limiting. Any user can spam them.
- **Risk**: API cost abuse, denial of service
- **Fix**: Add rate limiting middleware or per-user cooldowns

### 1.4 tRPC Error Handling
- **Issue**: Many mutations return `{ error: "..." }` objects instead of throwing `TRPCError`. This means the client gets a 200 OK with an error message inside, making error handling inconsistent.
- **Examples**: `agent.reason` returns `{ error: "Agent not found" }`, `crafting.craft` returns `{ error: "Recipe not found" }`, `crafting.discover` returns `{ success: false, error: "..." }`
- **Fix**: Throw `TRPCError` with appropriate codes (NOT_FOUND, FORBIDDEN, etc.)

### 1.5 Zod Validation Gaps
- **File**: `server/routers.ts:192`
- **Issue**: `agentData: z.any().optional()` — accepts any data without validation
- **Risk**: Arbitrary data injection into the database


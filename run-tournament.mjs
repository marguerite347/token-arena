/**
 * MASSIVE MULTI-LLM TOURNAMENT
 * 
 * Runs 12+ matches across factions with 6 different LLMs:
 * - Claude 3.5 Sonnet (analytical, considers all angles)
 * - GPT-4o (pragmatic, balanced, risk-aware)
 * - Llama 3.1 70B (aggressive, direct, bold)
 * - Mistral Large (methodical, defensive, conservative)
 * - Gemini 2.0 Flash (fast, opportunistic, reactive)
 * - DeepSeek V3 (strategic, long-term, pattern-exploiting)
 * 
 * Generates rich data: faction dynamics, memory accumulation,
 * reputation changes, prediction market activity, economic decisions
 */

const BASE_URL = "http://localhost:3000/api/trpc";

async function trpcCall(path, input, isMutation = false) {
  if (isMutation) {
    const res = await fetch(`${BASE_URL}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    const result = data.result?.data;
    return result?.json ?? result;
  } else {
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    const res = await fetch(`${BASE_URL}/${path}?input=${encoded}`);
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    const result = data.result?.data;
    return result?.json ?? result;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  TOKEN ARENA — MASSIVE MULTI-LLM TOURNAMENT            ║");
  console.log("║  6 Models × 3 Factions × 12+ Matches                   ║");
  console.log("║  $130 OpenRouter Credits Available                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ── Phase 1: Seed Agents ──────────────────────────────────────
  console.log("━━━ PHASE 1: SEED AGENTS ━━━");
  try {
    await trpcCall("flywheel.seed", {}, true);
    console.log("  ✓ Agents seeded\n");
  } catch (e) {
    console.log("  ✓ Agents already exist\n");
  }

  // ── Phase 2: Fetch All Agents ─────────────────────────────────
  console.log("━━━ PHASE 2: FETCH AGENTS ━━━");
  let agents = [];
  try {
    const result = await trpcCall("flywheel.all", {});
    agents = Array.isArray(result) ? result : (result?.json ? result.json : []);
    console.log(`  Found ${agents.length} agents:`);
    for (const a of agents) {
      console.log(`    #${a.agentId} ${a.agentName} [${a.llmLabel || a.llmModel || "AI"}] — Wins: ${a.wins || 0}, Losses: ${a.losses || 0}`);
    }
  } catch (e) {
    console.log(`  ⚠ Could not fetch agents: ${e.message?.slice(0, 200)}`);
  }
  console.log();

  // ── Phase 3: Create/Refresh Factions ──────────────────────────
  console.log("━━━ PHASE 3: CREATE FACTIONS ━━━");
  const factionDefs = [
    { name: "SHADOW COLLECTIVE", tag: "SHDW", motto: "Strike from the darkness — stealth and deception win wars", leaderAgentId: agents[0]?.agentId || 1, leaderAgentName: agents[0]?.agentName || "Agent 1", color: "#9D00FF" },
    { name: "IRON VANGUARD", tag: "IRON", motto: "Strength in unity — overwhelming force prevails", leaderAgentId: agents[2]?.agentId || 3, leaderAgentName: agents[2]?.agentName || "Agent 3", color: "#FF3366" },
    { name: "NEON SYNDICATE", tag: "NEON", motto: "Profit above all — the market is the battlefield", leaderAgentId: agents[4]?.agentId || 5, leaderAgentName: agents[4]?.agentName || "Agent 5", color: "#39FF14" },
  ];

  const factionIds = [];
  for (const f of factionDefs) {
    try {
      const result = await trpcCall("factions.create", f, true);
      const fid = result?.id || result?.factionId || result;
      factionIds.push(fid);
      console.log(`  ✓ ${f.name} [${f.tag}] — "${f.motto}"`);
    } catch (e) {
      console.log(`  ⚠ ${f.name}: ${e.message?.slice(0, 100)}`);
      factionIds.push(null);
    }
  }
  console.log();

  // ── Phase 4: Assign Agents to Factions ────────────────────────
  console.log("━━━ PHASE 4: ASSIGN AGENTS TO FACTIONS ━━━");
  const assignments = [
    { agentIdx: 1, factionIdx: 0 },
    { agentIdx: 3, factionIdx: 1 },
    { agentIdx: 5, factionIdx: 2 },
  ];
  for (const { agentIdx, factionIdx } of assignments) {
    const agent = agents[agentIdx];
    const factionId = factionIds[factionIdx];
    if (!agent || !factionId) continue;
    try {
      await trpcCall("factions.join", { agentId: agent.agentId, factionId, agentName: agent.agentName }, true);
      console.log(`  ✓ ${agent.agentName} [${agent.llmLabel || "AI"}] → ${factionDefs[factionIdx].name}`);
    } catch (e) {
      console.log(`  ⚠ ${agent.agentName}: ${e.message?.slice(0, 100)}`);
    }
  }
  console.log();

  // ── Phase 5: MASSIVE TOURNAMENT — 4 Rounds × 3 Matches Each ──
  console.log("━━━ PHASE 5: MASSIVE TOURNAMENT (4 ROUNDS) ━━━");
  const tournamentResults = [];
  const roundNames = [
    "ROUND 1 — Opening Skirmishes",
    "ROUND 2 — Faction Wars Escalate", 
    "ROUND 3 — Memory Accumulation",
    "ROUND 4 — Championship Finals"
  ];

  for (let round = 0; round < 4; round++) {
    console.log(`\n  ┌─────────────────────────────────────────┐`);
    console.log(`  │  ${roundNames[round].padEnd(39)} │`);
    console.log(`  └─────────────────────────────────────────┘`);
    
    try {
      const result = await trpcCall("flywheel.playtest", { rounds: 3 }, true);
      console.log(`  ✓ Round ${round + 1} complete!`);
      
      if (result?.matches) {
        console.log(`  Matches played: ${result.matches.length}`);
        for (const match of result.matches) {
          const a1 = match.agents?.[0];
          const a2 = match.agents?.[1];
          const winner = match.winner || "Draw";
          const reasoning1 = a1?.reasoning?.slice(0, 80) || "—";
          const reasoning2 = a2?.reasoning?.slice(0, 80) || "—";
          
          console.log(`\n    ⚔️  ${a1?.name || "?"} [${a1?.llmLabel || "?"}] vs ${a2?.name || "?"} [${a2?.llmLabel || "?"}]`);
          console.log(`       Winner: ${winner}`);
          console.log(`       ${a1?.name || "?"}: "${reasoning1}..."`);
          console.log(`       ${a2?.name || "?"}: "${reasoning2}..."`);
          
          tournamentResults.push({
            round: round + 1,
            agent1: a1?.name,
            agent1Model: a1?.llmLabel,
            agent2: a2?.name,
            agent2Model: a2?.llmLabel,
            winner,
          });
        }
      }
      
      if (result?.summary) {
        console.log(`\n  📊 Round Summary: ${result.summary}`);
      }
    } catch (e) {
      console.log(`  ⚠ Round ${round + 1} error: ${e.message?.slice(0, 200)}`);
    }
    
    // Brief pause between rounds to let memory accumulate
    console.log(`\n  ⏳ Pausing 2s for memory consolidation...`);
    await sleep(2000);
  }

  // ── Phase 6: Uniswap Flywheel Swaps ──────────────────────────
  console.log("\n━━━ PHASE 6: UNISWAP FLYWHEEL SWAPS ━━━");
  for (const agent of agents.slice(0, 6)) {
    const earnings = 100 + Math.floor(Math.random() * 400);
    try {
      const result = await trpcCall("uniswap.runCycle", {
        agentId: agent.agentId,
        arenaEarnings: earnings,
      }, true);
      console.log(`  ✓ ${agent.agentName} [${agent.llmLabel || "AI"}]: Earned ${earnings} ARENA → ${result?.summary || "Cycle complete"}`);
    } catch (e) {
      console.log(`  ⚠ ${agent.agentName}: ${e.message?.slice(0, 100)}`);
    }
  }

  // ── Phase 7: Reputation Check ─────────────────────────────────
  console.log("\n━━━ PHASE 7: REPUTATION LEADERBOARD ━━━");
  try {
    const repResult = await trpcCall("reputation.leaderboard", {});
    const leaderboard = Array.isArray(repResult) ? repResult : (repResult?.json || []);
    for (const entry of leaderboard.slice(0, 10)) {
      console.log(`  ${entry.tier || "?"} ${entry.agentName || entry.name || "?"} — Score: ${entry.score || 0} | Wins: ${entry.wins || 0}`);
    }
  } catch (e) {
    console.log(`  ⚠ Reputation: ${e.message?.slice(0, 100)}`);
  }

  // ── Phase 8: Memory NFT Check ─────────────────────────────────
  console.log("\n━━━ PHASE 8: MEMORY MARKETPLACE ━━━");
  try {
    const memResult = await trpcCall("memoryMarket.available", {});
    const memories = Array.isArray(memResult) ? memResult : (memResult?.json || []);
    console.log(`  Available Memory NFTs: ${memories.length}`);
    for (const mem of memories.slice(0, 5)) {
      console.log(`  🧠 ${mem.agentName || "Unknown"} — Price: ${mem.price || "?"} ARENA | Quality: ${mem.quality || "?"}`);
    }
  } catch (e) {
    console.log(`  ⚠ Memory Market: ${e.message?.slice(0, 100)}`);
  }

  // ── Phase 9: Tournament Summary ───────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  TOURNAMENT COMPLETE                                    ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`\n  Total matches: ${tournamentResults.length}`);
  
  // Model win counts
  const modelWins = {};
  for (const r of tournamentResults) {
    if (r.winner && r.winner !== "Draw") {
      const model = r.winner === r.agent1 ? r.agent1Model : r.agent2Model;
      modelWins[model] = (modelWins[model] || 0) + 1;
    }
  }
  console.log("\n  🏆 MODEL PERFORMANCE:");
  const sorted = Object.entries(modelWins).sort((a, b) => b[1] - a[1]);
  for (const [model, wins] of sorted) {
    console.log(`    ${model}: ${wins} wins`);
  }

  console.log("\n  Check the UI at:");
  console.log("    /flywheel  — Full flywheel dashboard with LLM badges");
  console.log("    /swap      — Uniswap swap interface (for judges)");
  console.log("    /factions  — Faction dynamics and rosters");
  console.log("    /auctions  — Memory NFT auction house");
  console.log("    /replays   — Match replays with LLM reasoning");
  console.log("    /betting   — Prediction market + Polymarket feed");
  console.log("    /dao-domains — DAO domain controllers");
}

main().catch(console.error);

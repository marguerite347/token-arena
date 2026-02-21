/**
 * Faction Playtest Runner — Seeds factions, runs multi-LLM matches, generates rich data
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

async function main() {
  console.log("=== FACTION PLAYTEST WITH MULTI-LLM AGENTS ===\n");

  // Step 1: Seed agents if needed
  console.log("[1/6] Seeding agents...");
  try {
    await trpcCall("flywheel.seed", {}, true);
    console.log("  ✓ Agents seeded\n");
  } catch (e) {
    console.log("  ✓ Agents already exist\n");
  }

  // Step 2: Get agents
  console.log("[2/6] Fetching agents...");
  let agents = [];
  try {
    const result = await trpcCall("flywheel.all", {});
    agents = Array.isArray(result) ? result : (result?.json ? result.json : []);
    console.log(`  Found ${agents.length} agents`);
    for (const a of agents.slice(0, 6)) {
      console.log(`    ${a.agentName} [Agent #${a.agentId}] — ${a.llmLabel || "AI"}`);
    }
  } catch (e) {
    console.log(`  ⚠ Could not fetch agents: ${e.message?.slice(0, 100)}`);
  }
  console.log();

  // Step 3: Create factions with proper schema
  console.log("[3/6] Creating factions...");
  const factionDefs = [
    { name: "SHADOW COLLECTIVE", tag: "SHDW", motto: "Strike from the darkness", leaderAgentId: agents[0]?.agentId || 1, leaderAgentName: agents[0]?.agentName || "Agent 1", color: "#9D00FF" },
    { name: "IRON VANGUARD", tag: "IRON", motto: "Strength in unity", leaderAgentId: agents[2]?.agentId || 3, leaderAgentName: agents[2]?.agentName || "Agent 3", color: "#FF3366" },
    { name: "NEON SYNDICATE", tag: "NEON", motto: "Profit above all", leaderAgentId: agents[4]?.agentId || 5, leaderAgentName: agents[4]?.agentName || "Agent 5", color: "#39FF14" },
  ];

  const factionIds = [];
  for (const f of factionDefs) {
    try {
      const result = await trpcCall("factions.create", f, true);
      const fid = result?.id || result?.factionId || result;
      factionIds.push(fid);
      console.log(`  ✓ Created faction: ${f.name} (ID: ${fid})`);
    } catch (e) {
      console.log(`  ⚠ Faction ${f.name}: ${e.message?.slice(0, 100)}`);
      factionIds.push(null);
    }
  }
  console.log();

  // Step 4: Assign remaining agents to factions
  console.log("[4/6] Assigning agents to factions...");
  // Agent 0 is already leader of faction 0, agent 2 of faction 1, agent 4 of faction 2
  // Assign agent 1 to faction 0, agent 3 to faction 1, agent 5 to faction 2
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

  // Step 5: Run multi-LLM playtest
  console.log("[5/6] Running multi-LLM playtest (3 rounds)...");
  try {
    const result = await trpcCall("flywheel.playtest", { rounds: 3 }, true);
    console.log(`  ✓ Playtest complete!`);
    if (result?.matches) {
      console.log(`  Matches played: ${result.matches.length}`);
      for (const match of result.matches) {
        const a1 = match.agents?.[0];
        const a2 = match.agents?.[1];
        console.log(`    ${a1?.name || "?"} [${a1?.llmLabel || "?"}] vs ${a2?.name || "?"} [${a2?.llmLabel || "?"}] → Winner: ${match.winner || "?"}`);
      }
    }
    if (result?.summary) {
      console.log(`\n  Summary: ${result.summary}`);
    }
  } catch (e) {
    console.log(`  ⚠ Playtest error: ${e.message?.slice(0, 200)}`);
  }
  console.log();

  // Step 6: Run flywheel swaps for top agents
  console.log("[6/6] Running Uniswap flywheel swaps...");
  for (const agent of agents.slice(0, 3)) {
    try {
      const result = await trpcCall("uniswap.runCycle", {
        agentId: agent.agentId,
        arenaEarnings: 200,
      }, true);
      console.log(`  ✓ ${agent.agentName}: ${result?.summary || "Cycle complete"}`);
    } catch (e) {
      console.log(`  ⚠ ${agent.agentName}: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log("\n=== FACTION PLAYTEST COMPLETE ===");
  console.log("Check the UI at /factions, /swap, /replays, and /flywheel for results.");
}

main().catch(console.error);

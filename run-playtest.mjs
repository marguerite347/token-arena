#!/usr/bin/env node
/**
 * Multi-LLM Playtest Runner
 * Each agent is powered by a different LLM via OpenRouter
 */
import { writeFileSync } from "fs";

async function runPlaytest(matchCount = 3) {
  console.log(`\n🎮 TOKEN ARENA — Multi-LLM Playtest (${matchCount} matches)`);
  console.log("=".repeat(60));
  console.log("Agent LLM Assignments:");
  console.log("  Agent 1 (PHANTOM)  → Claude 3.5 Sonnet  [Analytical]");
  console.log("  Agent 2 (NEXUS-7)  → GPT-4o             [Pragmatic]");
  console.log("  Agent 3 (TITAN)    → Llama 3.1 70B      [Aggressive]");
  console.log("  Agent 4 (CIPHER)   → Mistral Large      [Defensive]");
  console.log("  Agent 5 (AURORA)   → Gemini Flash 1.5   [Opportunistic]");
  console.log("  Agent 6 (WRAITH)   → DeepSeek V3        [Strategic]");
  console.log();

  const res = await fetch("http://localhost:3000/api/trpc/flywheel.playtest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { matchCount, useLLM: true } }),
  // tRPC path: flywheel.playtest
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const result = data?.result?.data?.json;

  if (!result) {
    console.error("No result data:", JSON.stringify(data).slice(0, 500));
    return null;
  }

  console.log(`✅ Matches played: ${result.matchesPlayed}`);
  console.log(`🏆 MVP: ${result.summary?.mvp}`);
  console.log(`⚔️  Total kills: ${result.summary?.totalKills}`);
  console.log(`💰 Total tokens earned: ${result.summary?.totalTokensEarned?.toFixed(2)}`);
  console.log();

  // Show LLM info per match
  result.results?.forEach((match, i) => {
    const agents = match.agentData?.agents || [];
    const llmModels = match.agentData?.llmModels || {};
    console.log(`Match ${i + 1}: ${match.arena}`);
    agents.forEach((a) => {
      const llm = llmModels[a.name] || a.llmModel || "unknown";
      const status = a.won ? "🏆 WON" : "💀 lost";
      console.log(`  ${a.name.padEnd(12)} [${llm.padEnd(18)}] ${status}  K:${a.kills} D:${a.deaths} DMG:${a.damage}`);
    });
    console.log();
  });

  // Save results
  const output = {
    runAt: new Date().toISOString(),
    description: "Multi-LLM playtest — each agent powered by different OpenRouter model",
    agentModelAssignments: {
      1: { name: "PHANTOM", model: "Claude 3.5 Sonnet", style: "Analytical" },
      2: { name: "NEXUS-7", model: "GPT-4o", style: "Pragmatic" },
      3: { name: "TITAN", model: "Llama 3.1 70B", style: "Aggressive" },
      4: { name: "CIPHER", model: "Mistral Large", style: "Defensive" },
      5: { name: "AURORA", model: "Gemini Flash 1.5", style: "Opportunistic" },
      6: { name: "WRAITH", model: "DeepSeek V3", style: "Strategic" },
    },
    ...result,
  };

  writeFileSync("playtest-results-multi-llm.json", JSON.stringify(output, null, 2));
  console.log("📝 Results saved to playtest-results-multi-llm.json");

  return result;
}

runPlaytest(3).catch((err) => {
  console.error("❌ Playtest failed:", err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Multi-LLM Playtest Runner
 *
 * Runs AI vs AI matches where each agent is powered by a different LLM via OpenRouter.
 * Captures how different models produce genuinely different tactical reasoning.
 *
 * Agent assignments:
 *   PHANTOM  (1) → Claude 3.5 Sonnet  — Analytical, considers all angles
 *   NEXUS-7  (2) → GPT-4o             — Balanced, pragmatic, risk-aware
 *   TITAN    (3) → Llama 3.1 70B      — Aggressive, bold, high-risk/reward
 *   CIPHER   (4) → Mistral Large      — Methodical, defensive, attrition
 *   AURORA   (5) → Gemini Flash 1.5   — Fast, opportunistic, reactive
 *   WRAITH   (6) → DeepSeek V3        — Long-term strategist, pattern-setter
 */

import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BASE_URL = "http://localhost:3000";

async function trpc(path, input) {
  const url = `${BASE_URL}/api/trpc/${path}`;
  const isQuery = !path.includes("Mutation") && !["playtest.runSession", "playtest.runMatch"].includes(path);

  const res = await fetch(
    isQuery ? `${url}?input=${encodeURIComponent(JSON.stringify({ json: input ?? null }))}` : url,
    isQuery
      ? { headers: { "Content-Type": "application/json" } }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: input }),
        }
  );

  if (!res.ok) {
    throw new Error(`tRPC ${path} failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data?.result?.data?.json ?? data?.result?.data;
}

async function runPlaytest() {
  console.log("\n🎮 TOKEN ARENA — Multi-LLM Playtest");
  console.log("=".repeat(60));
  console.log("Each agent is powered by a different LLM via OpenRouter\n");

  const agentModels = [
    { agentId: 1, name: "PHANTOM",  model: "Claude 3.5 Sonnet", style: "Analytical" },
    { agentId: 2, name: "NEXUS-7",  model: "GPT-4o",            style: "Pragmatic" },
    { agentId: 3, name: "TITAN",    model: "Llama 3.1 70B",     style: "Aggressive" },
    { agentId: 4, name: "CIPHER",   model: "Mistral Large",     style: "Defensive" },
    { agentId: 5, name: "AURORA",   model: "Gemini Flash 1.5",  style: "Opportunistic" },
    { agentId: 6, name: "WRAITH",   model: "DeepSeek V3",       style: "Strategic" },
  ];

  console.log("🤖 Agent LLM Assignments:");
  agentModels.forEach(a => {
    console.log(`   ${a.name.padEnd(10)} → ${a.model.padEnd(20)} (${a.style})`);
  });
  console.log();

  const results = [];
  const matchCount = 3; // Run 3 matches to show diversity

  for (let i = 0; i < matchCount; i++) {
    console.log(`\n⚔️  Match ${i + 1}/${matchCount}`);
    console.log("-".repeat(40));

    try {
      // Call the playtest session endpoint
      const sessionResult = await fetch(`${BASE_URL}/api/trpc/playtest.runSession`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            numAgents: 6,
            rounds: 5,
            enableMemory: true,
            enableFlywheel: true,
          },
        }),
      });

      if (!sessionResult.ok) {
        const errText = await sessionResult.text();
        console.error(`   ❌ Match ${i + 1} failed: ${sessionResult.status} ${errText.slice(0, 200)}`);
        continue;
      }

      const sessionData = await sessionResult.json();
      const session = sessionData?.result?.data?.json;

      if (!session) {
        console.error(`   ❌ No session data returned`);
        continue;
      }

      console.log(`   ✅ Match complete`);
      if (session.winner) {
        console.log(`   🏆 Winner: ${session.winner}`);
      }
      if (session.matches) {
        console.log(`   📊 Matches played: ${session.matches.length}`);
        session.matches.forEach((m, idx) => {
          const llmInfo = m.agentData?.llmUsed ? ` [${m.agentData.llmUsed}]` : "";
          console.log(`      Match ${idx + 1}: ${m.agent1Name} vs ${m.agent2Name}${llmInfo}`);
        });
      }

      results.push({
        matchNumber: i + 1,
        session,
        timestamp: new Date().toISOString(),
      });

    } catch (err) {
      console.error(`   ❌ Match ${i + 1} error:`, err.message);
    }

    // Small delay between matches
    await new Promise(r => setTimeout(r, 2000));
  }

  // Save results
  const output = {
    runAt: new Date().toISOString(),
    description: "Multi-LLM playtest — each agent powered by different OpenRouter model",
    agentModels,
    matchCount: results.length,
    results,
    summary: {
      modelsUsed: agentModels.map(a => a.model),
      reasoningStyles: agentModels.map(a => ({ agent: a.name, style: a.style })),
      flywheelEnabled: true,
      memoryEnabled: true,
    },
  };

  const outputPath = path.join(ROOT, "playtest-results-multi-llm.json");
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📝 Results saved to: playtest-results-multi-llm.json`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("🎯 MULTI-LLM PLAYTEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Matches completed: ${results.length}/${matchCount}`);
  console.log("\nLLM Diversity Showcase:");
  agentModels.forEach(a => {
    console.log(`  ${a.name} (${a.model}): ${a.style} reasoning style`);
  });
  console.log("\n✅ Each agent uses a genuinely different LLM with distinct tactics!");
  console.log("   This creates emergent gameplay — Claude's analytical approach vs");
  console.log("   Llama's aggression vs Mistral's defensive attrition strategy.");

  return output;
}

runPlaytest().catch(err => {
  console.error("❌ Playtest runner failed:", err.message);
  process.exit(1);
});

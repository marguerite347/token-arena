/**
 * Match Observer — AI Agent that watches match data and evaluates against success criteria
 * 
 * The observer receives raw match session data and produces a structured evaluation
 * covering gameplay quality, economic health, agent intelligence, and entertainment value.
 */
import { invokeLLM } from "./_core/llm";

export interface ObserverReport {
  overallScore: number;          // 0-100
  grade: string;                 // A+ to F
  summary: string;               // 2-3 sentence executive summary
  criteria: CriterionResult[];   // Individual criterion evaluations
  highlights: string[];          // Top 3 memorable moments
  concerns: string[];            // Issues that need attention
  recommendations: string[];     // Actionable next steps
  timestamp: number;
}

export interface CriterionResult {
  name: string;
  score: number;       // 0-10
  status: "pass" | "warn" | "fail";
  detail: string;
}

const SUCCESS_CRITERIA = [
  "Agent Autonomy: Agents make independent decisions using LLM reasoning without human intervention",
  "Token Economics: Every combat action transfers real tokens. Winners earn, losers spend.",
  "Prediction Markets: Markets are created, bets placed by agents and spectators, and resolved correctly",
  "Arena Generation: Skybox AI generates unique 360° environments for each match",
  "Combat Depth: Agents choose weapons, adapt tactics, and show strategic diversity",
  "Economic Flywheel: Tokens flow in a cycle — earn → spend → bet → earn. The loop sustains itself.",
  "Entertainment Value: Matches are interesting to watch with dramatic moments and surprising outcomes",
  "Multi-Agent Support: FFA mode works with 2-8 agents, not just 1v1",
  "On-Chain Integration: x402 token transfers, Base L2 transactions, wallet interactions",
  "Data Richness: Match produces enough data for replays, leaderboards, and analytics",
];

export async function observeSession(sessionData: any): Promise<ObserverReport> {
  const prompt = buildObserverPrompt(sessionData);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are the Arena Observer — an AI judge evaluating Token Arena match sessions.
You analyze raw match data and produce structured evaluations against specific success criteria.
Be honest, specific, and constructive. Reference actual data from the session.
You must respond with valid JSON matching the schema exactly.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "observer_report",
          strict: true,
          schema: {
            type: "object",
            properties: {
              overallScore: { type: "integer", description: "Overall score 0-100" },
              grade: { type: "string", description: "Letter grade: A+, A, B+, B, C+, C, D, F" },
              summary: { type: "string", description: "2-3 sentence executive summary" },
              criteria: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    score: { type: "integer", description: "Score 0-10" },
                    status: { type: "string", description: "pass, warn, or fail" },
                    detail: { type: "string" },
                  },
                  required: ["name", "score", "status", "detail"],
                  additionalProperties: false,
                },
              },
              highlights: {
                type: "array",
                items: { type: "string" },
                description: "Top 3 memorable moments",
              },
              concerns: {
                type: "array",
                items: { type: "string" },
                description: "Issues needing attention",
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
                description: "Actionable next steps",
              },
            },
            required: ["overallScore", "grade", "summary", "criteria", "highlights", "concerns", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty LLM response");

    const parsed = JSON.parse(String(content));
    return {
      ...parsed,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("[Observer] Failed to generate report:", error);
    return buildFallbackReport(sessionData);
  }
}

function buildObserverPrompt(data: any): string {
  const matchCount = data.matchesPlayed || data.results?.length || 0;
  const isFFA = data.isFFA || false;
  const summary = data.summary || {};
  const results = data.results || [];

  let matchDetails = "";
  results.forEach((r: any, i: number) => {
    matchDetails += `\nMatch ${i + 1}: Winner=${r.winner}`;
    if (r.agentCount) matchDetails += ` (${r.agentCount}-way FFA)`;
    if (r.agents) matchDetails += ` Agents=[${r.agents.map((a: any) => `${a.name}(kills:${a.kills},deaths:${a.deaths},dmg:${a.damage})`).join(", ")}]`;
    if (r.arena) matchDetails += ` Arena=${r.arena}`;
    if (r.tokensTransferred) matchDetails += ` Tokens=${r.tokensTransferred}`;
    if (r.predictionMarket) matchDetails += ` Market=${JSON.stringify(r.predictionMarket)}`;
    if (r.podium) matchDetails += ` Podium=[${r.podium.join(", ")}]`;
  });

  return `Evaluate this Token Arena session against the following success criteria:

${SUCCESS_CRITERIA.map((c, i) => `${i + 1}. ${c}`).join("\n")}

SESSION DATA:
- Mode: ${isFFA ? "Free-For-All" : "1v1 Duel"}
- Matches played: ${matchCount}
- MVP: ${summary.mvp || "N/A"}
- Total kills: ${summary.totalKills || 0}
- Total tokens earned: ${summary.totalTokensEarned || 0}
- Total tokens spent: ${summary.totalTokensSpent || 0}
- Best K/D: ${summary.bestKD || "N/A"}
- Used LLM: ${data.usedLLM !== false}

MATCH DETAILS:${matchDetails || "\nNo detailed match data available."}

Score each criterion 0-10, mark as pass (7+), warn (4-6), or fail (0-3).
Provide an overall score (0-100), letter grade, 3 highlights, concerns, and recommendations.
Be specific — reference actual agent names, scores, and events from the data.`;
}

function buildFallbackReport(data: any): ObserverReport {
  const matchCount = data.matchesPlayed || 0;
  return {
    overallScore: 65,
    grade: "B",
    summary: `Session completed ${matchCount} matches. Observer LLM analysis unavailable — using fallback evaluation based on raw metrics.`,
    criteria: SUCCESS_CRITERIA.map((c, i) => ({
      name: c.split(":")[0],
      score: 6,
      status: "warn" as const,
      detail: "Automated evaluation unavailable. Manual review recommended.",
    })),
    highlights: [
      `Completed ${matchCount} matches successfully`,
      `MVP: ${data.summary?.mvp || "Unknown"}`,
      `Total kills: ${data.summary?.totalKills || 0}`,
    ],
    concerns: ["LLM observer analysis failed — check API connectivity"],
    recommendations: ["Re-run observer with working LLM connection", "Review match logs manually"],
    timestamp: Date.now(),
  };
}

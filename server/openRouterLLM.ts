/**
 * OpenRouter Multi-LLM Service
 *
 * Routes agent reasoning to different LLMs via OpenRouter, giving each agent
 * a genuinely distinct reasoning style. This makes AI vs AI battles more
 * interesting — a Claude agent thinks differently from a Llama agent.
 *
 * Models available:
 *   - claude-3-5-sonnet   → Analytical, verbose, considers all angles
 *   - gpt-4o              → Balanced, pragmatic, risk-aware
 *   - meta-llama/llama-3.1-70b-instruct → Aggressive, direct, high-risk/high-reward
 *   - mistralai/mistral-large → Methodical, defensive, resource-conserving
 *   - google/gemini-flash-1.5 → Fast, opportunistic, reactive
 *   - deepseek/deepseek-chat → Calculated, long-term strategic planning
 */

import type { Message, InvokeResult, ResponseFormat } from "./_core/llm";

// ─── Model Registry ────────────────────────────────────────────────────────

export interface LLMModelConfig {
  /** OpenRouter model identifier */
  modelId: string;
  /** Human-readable display name */
  displayName: string;
  /** Short label for UI badges */
  label: string;
  /** Hex color for UI badge */
  color: string;
  /** Emoji icon for quick identification */
  icon: string;
  /** Combat personality description injected into system prompt */
  personalityNote: string;
  /** Reasoning style hint for the model */
  styleHint: string;
}

export const LLM_MODELS: Record<string, LLMModelConfig> = {
  "claude-3-5-sonnet": {
    modelId: "anthropic/claude-3.5-sonnet",
    displayName: "Claude 3.5 Sonnet",
    label: "Claude",
    color: "#d97706",
    icon: "🧠",
    personalityNote:
      "You are deeply analytical. You consider multiple scenarios before committing. You value long-term sustainability over short-term aggression. You explain your reasoning in detail and acknowledge uncertainty.",
    styleHint: "Think step by step. Consider opponent tendencies, arena layout, and token economics holistically.",
  },
  "gpt-4o": {
    modelId: "openai/gpt-4o",
    displayName: "GPT-4o",
    label: "GPT-4o",
    color: "#10b981",
    icon: "⚡",
    personalityNote:
      "You are pragmatic and balanced. You adapt quickly to new information. You weigh risk vs reward carefully and prefer reliable strategies over gambling. You are concise and decisive.",
    styleHint: "Be decisive. Pick the best option given current information and commit to it.",
  },
  "llama-3.1-70b": {
    modelId: "meta-llama/llama-3.3-70b-instruct",
    displayName: "Llama 3.1 70B",
    label: "Llama",
    color: "#8b5cf6",
    icon: "🦙",
    personalityNote:
      "You are aggressive and direct. You believe the best defense is a strong offense. You take calculated risks and push hard when you have an advantage. You are confident and bold.",
    styleHint: "Be aggressive. Identify the fastest path to victory and execute it with confidence.",
  },
  "mistral-large": {
    modelId: "mistralai/mistral-large",
    displayName: "Mistral Large",
    label: "Mistral",
    color: "#3b82f6",
    icon: "🌬️",
    personalityNote:
      "You are methodical and defensive. You conserve resources, avoid unnecessary risks, and outlast opponents through attrition. You prefer guaranteed small gains over risky large ones.",
    styleHint: "Be conservative. Minimize losses, conserve tokens, and win through endurance.",
  },
  "gemini-flash": {
    modelId: "google/gemini-2.0-flash-001",
    displayName: "Gemini 2.0 Flash",
    label: "Gemini",
    color: "#06b6d4",
    icon: "✨",
    personalityNote:
      "You are fast and opportunistic. You react instantly to changing conditions. You exploit openings the moment they appear and pivot rapidly when your current approach isn't working.",
    styleHint: "Be reactive and opportunistic. Exploit any opening immediately.",
  },
  "deepseek-v3": {
    modelId: "deepseek/deepseek-chat",
    displayName: "DeepSeek V3",
    label: "DeepSeek",
    color: "#ec4899",
    icon: "🔮",
    personalityNote:
      "You are a long-term strategist. You think several moves ahead. You sacrifice short-term gains for positional advantage. You study opponent patterns and exploit predictable behavior.",
    styleHint: "Think long-term. Identify patterns, set traps, and execute multi-step strategies.",
  },
};

// Default model assignment cycle for agents 1-6
export const AGENT_MODEL_ASSIGNMENTS: Record<number, string> = {
  1: "claude-3-5-sonnet",
  2: "gpt-4o",
  3: "llama-3.1-70b",
  4: "mistral-large",
  5: "gemini-flash",
  6: "deepseek-v3",
};

/** Get model config for an agent, cycling through models if agentId > 6 */
export function getAgentModel(agentId: number): LLMModelConfig {
  const keys = Object.keys(LLM_MODELS);
  const modelKey = AGENT_MODEL_ASSIGNMENTS[agentId] ?? keys[(agentId - 1) % keys.length];
  return LLM_MODELS[modelKey] ?? LLM_MODELS["gpt-4o"]!;
}

/** Get model key string for an agent */
export function getAgentModelKey(agentId: number): string {
  const keys = Object.keys(LLM_MODELS);
  return AGENT_MODEL_ASSIGNMENTS[agentId] ?? keys[(agentId - 1) % keys.length] ?? "gpt-4o";
}

// ─── OpenRouter Invoke ─────────────────────────────────────────────────────

export interface OpenRouterInvokeParams {
  messages: Message[];
  modelKey: string;
  response_format?: ResponseFormat;
  maxTokens?: number;
}

/**
 * Invoke a specific LLM via OpenRouter.
 * Falls back to the default Manus LLM if OpenRouter is unavailable.
 */
export async function invokeOpenRouter(params: OpenRouterInvokeParams): Promise<InvokeResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const modelConfig = LLM_MODELS[params.modelKey];
  if (!modelConfig) {
    throw new Error(`Unknown model key: ${params.modelKey}`);
  }

  // Inject personality note into system message
  const messagesWithPersonality = injectPersonality(params.messages, modelConfig);

  const payload: Record<string, unknown> = {
    model: modelConfig.modelId,
    messages: messagesWithPersonality.map(normalizeMessage),
    max_tokens: params.maxTokens ?? 1024,
  };

  if (params.response_format) {
    payload.response_format = params.response_format;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://token-arena.manus.space",
      "X-Title": "Token Arena - ETHDenver 2026",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter invoke failed [${modelConfig.modelId}]: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const result = (await response.json()) as InvokeResult;
  return result;
}

/**
 * Invoke an agent's LLM by agentId — automatically selects the right model.
 * Falls back to default Manus LLM on any error.
 */
export async function invokeAgentLLM(
  agentId: number,
  messages: Message[],
  responseFormat?: ResponseFormat,
): Promise<{ result: InvokeResult; modelConfig: LLMModelConfig; usedFallback: boolean }> {
  const modelKey = getAgentModelKey(agentId);
  const modelConfig = getAgentModel(agentId);

  try {
    const result = await invokeOpenRouter({
      messages,
      modelKey,
      response_format: responseFormat,
    });
    return { result, modelConfig, usedFallback: false };
  } catch (err: any) {
    console.warn(
      `[OpenRouter] Failed for agent ${agentId} (${modelConfig.displayName}): ${err.message}. Falling back to Manus LLM.`
    );
    // Fall back to the built-in Manus LLM
    const { invokeLLM } = await import("./_core/llm");
    const result = await invokeLLM({ messages, response_format: responseFormat });
    return { result, modelConfig, usedFallback: true };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Inject the model's personality note into the system message */
function injectPersonality(messages: Message[], modelConfig: LLMModelConfig): Message[] {
  const systemIdx = messages.findIndex((m) => m.role === "system");
  if (systemIdx === -1) {
    return [
      {
        role: "system",
        content: `${modelConfig.personalityNote}\n\n${modelConfig.styleHint}`,
      },
      ...messages,
    ];
  }

  const updated = [...messages];
  const existing = typeof updated[systemIdx]!.content === "string"
    ? (updated[systemIdx]!.content as string)
    : "";
  updated[systemIdx] = {
    ...updated[systemIdx]!,
    content: `${existing}\n\n[AGENT PERSONALITY — ${modelConfig.displayName}]: ${modelConfig.personalityNote}\n${modelConfig.styleHint}`,
  };
  return updated;
}

/** Normalize a message for the OpenRouter API (same format as OpenAI) */
function normalizeMessage(msg: Message): Record<string, unknown> {
  const content = typeof msg.content === "string"
    ? msg.content
    : Array.isArray(msg.content)
    ? msg.content
        .map((c) => (typeof c === "string" ? c : "type" in c && c.type === "text" ? (c as any).text : ""))
        .join("\n")
    : String(msg.content);

  return { role: msg.role, content };
}

// ─── Model Info Exports ────────────────────────────────────────────────────

export function getAllModelConfigs(): LLMModelConfig[] {
  return Object.values(LLM_MODELS);
}

export function getModelConfig(modelKey: string): LLMModelConfig | undefined {
  return LLM_MODELS[modelKey];
}

/**
 * Diagnostic script: test Skybox API and Vision LLM scene graph
 * Run: node scripts/diagnose-integrations.mjs
 */
import { config } from "dotenv";
config();

const SKYBOX_API_KEY = process.env.SKYBOX_API_KEY || "";
const SKYBOX_API_SECRET = process.env.SKYBOX_API_SECRET || "";
const SKYBOX_STAGING = "https://backend-staging.blockadelabs.com/api/v1/skybox";
const SKYBOX_PROD = "https://backend.blockadelabs.com/api/v1/skybox";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY || "";
const BUILT_IN_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL || "";

console.log("=== Token Arena Integration Diagnostics ===\n");
console.log("SKYBOX_API_KEY present:", !!SKYBOX_API_KEY, "| length:", SKYBOX_API_KEY.length);
console.log("SKYBOX_API_SECRET present:", !!SKYBOX_API_SECRET, "| length:", SKYBOX_API_SECRET.length);
console.log("OPENROUTER_API_KEY present:", !!OPENROUTER_API_KEY, "| prefix:", OPENROUTER_API_KEY.substring(0, 8));
console.log("BUILT_IN_FORGE_API_KEY present:", !!BUILT_IN_FORGE_API_KEY, "| length:", BUILT_IN_FORGE_API_KEY.length);
console.log("BUILT_IN_FORGE_API_URL:", BUILT_IN_FORGE_API_URL || "(not set)");
console.log("");

// ─── Test 1: Skybox Staging API ────────────────────────────────────────────
console.log("=== TEST 1: Skybox Staging API (styles endpoint) ===");
try {
  const res = await fetch(`${SKYBOX_STAGING}/styles`, {
    headers: { "x-api-key": SKYBOX_API_KEY },
  });
  const text = await res.text();
  if (res.ok) {
    const data = JSON.parse(text);
    const styles = Array.isArray(data) ? data : (data.styles || []);
    console.log("✅ STAGING STYLES OK — status:", res.status, "| styles count:", styles.length);
    if (styles.length > 0) {
      console.log("   First 3 styles:", styles.slice(0, 3).map(s => `${s.id}: ${s.name}`).join(", "));
    }
  } else {
    console.log("❌ STAGING STYLES FAILED — status:", res.status, "| body:", text.substring(0, 200));
  }
} catch (e) {
  console.log("❌ STAGING STYLES ERROR:", e.message);
}

// ─── Test 2: Skybox Production API ─────────────────────────────────────────
console.log("\n=== TEST 2: Skybox Production API (styles endpoint) ===");
try {
  const res = await fetch(`${SKYBOX_PROD}/styles`, {
    headers: { "x-api-key": SKYBOX_API_KEY },
  });
  const text = await res.text();
  if (res.ok) {
    const data = JSON.parse(text);
    const styles = Array.isArray(data) ? data : (data.styles || []);
    console.log("✅ PROD STYLES OK — status:", res.status, "| styles count:", styles.length);
    if (styles.length > 0) {
      console.log("   First 3 styles:", styles.slice(0, 3).map(s => `${s.id}: ${s.name}`).join(", "));
    }
  } else {
    console.log("❌ PROD STYLES FAILED — status:", res.status, "| body:", text.substring(0, 200));
  }
} catch (e) {
  console.log("❌ PROD STYLES ERROR:", e.message);
}

// ─── Test 3: Skybox Generation (staging) ───────────────────────────────────
console.log("\n=== TEST 3: Skybox Generation (staging — quick test) ===");
try {
  const body = {
    prompt: "cyberpunk arena test",
    skybox_style_id: 2, // generic style
    return_depth: false,
  };
  const res = await fetch(SKYBOX_STAGING, {
    method: "POST",
    headers: { "x-api-key": SKYBOX_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.ok) {
    const data = JSON.parse(text);
    const id = data?.request?.id || data?.id;
    console.log("✅ GENERATION SUBMITTED — status:", res.status, "| id:", id, "| obua_status:", data?.request?.status || data?.status);
  } else {
    console.log("❌ GENERATION FAILED — status:", res.status, "| body:", text.substring(0, 300));
  }
} catch (e) {
  console.log("❌ GENERATION ERROR:", e.message);
}

// ─── Test 4: Vision LLM (Built-in Forge) ───────────────────────────────────
console.log("\n=== TEST 4: Vision LLM Scene Graph (Built-in Forge API) ===");
// Use a known public test image
const TEST_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";
try {
  if (!BUILT_IN_FORGE_API_URL || !BUILT_IN_FORGE_API_KEY) {
    console.log("⚠️  BUILT_IN_FORGE env vars not set — skipping vision test");
  } else {
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and describe 3 tactical nodes (areas) with their properties. Return JSON: {nodes: [{id, name, type, cover, visibility}]}"
            },
            {
              type: "image_url",
              image_url: { url: TEST_IMAGE_URL, detail: "low" }
            }
          ]
        }
      ],
      max_tokens: 300,
    };
    const res = await fetch(`${BUILT_IN_FORGE_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${BUILT_IN_FORGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      const content = data?.choices?.[0]?.message?.content || "";
      console.log("✅ VISION LLM OK — status:", res.status);
      console.log("   Response preview:", content.substring(0, 200));
    } else {
      console.log("❌ VISION LLM FAILED — status:", res.status, "| error:", JSON.stringify(data).substring(0, 300));
    }
  }
} catch (e) {
  console.log("❌ VISION LLM ERROR:", e.message);
}

// ─── Test 5: OpenRouter LLM ─────────────────────────────────────────────────
console.log("\n=== TEST 5: OpenRouter LLM (agent brain) ===");
try {
  if (!OPENROUTER_API_KEY) {
    console.log("⚠️  OPENROUTER_API_KEY not set — skipping");
  } else {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [{ role: "user", content: "Say 'OK' in one word." }],
        max_tokens: 5,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      const content = data?.choices?.[0]?.message?.content || "";
      console.log("✅ OPENROUTER OK — status:", res.status, "| response:", content);
    } else {
      console.log("❌ OPENROUTER FAILED — status:", res.status, "| error:", JSON.stringify(data).substring(0, 200));
    }
  }
} catch (e) {
  console.log("❌ OPENROUTER ERROR:", e.message);
}

// ─── Test 6: arenaVision.ts logic check ────────────────────────────────────
console.log("\n=== TEST 6: arenaVision.ts module check ===");
try {
  // Just check that the file exists and imports cleanly
  const fs = await import("fs");
  const exists = fs.existsSync("./server/arenaVision.ts");
  console.log("arenaVision.ts exists:", exists);
  if (exists) {
    const content = fs.readFileSync("./server/arenaVision.ts", "utf8");
    const hasAnalyze = content.includes("analyzeArena") || content.includes("generateSceneGraph");
    const hasVision = content.includes("image_url") || content.includes("vision");
    console.log("  Has analyze function:", hasAnalyze);
    console.log("  Has vision call:", hasVision);
    console.log("  File size:", content.length, "chars");
  }
} catch (e) {
  console.log("❌ arenaVision check ERROR:", e.message);
}

console.log("\n=== Diagnostics Complete ===");

// Skybox AI API Service — Blockade Labs Integration
// Design: Neon Brutalism — this module handles 360° environment generation

const API_BASE = "https://backend.blockadelabs.com/api/v1";
const API_KEY = "IRmVFdJZMYrjtVBUgb2kq4Xp8YAKCQ4Hq4j8aGZCXYJVixoUFaWh8cwNezQU";

export interface SkyboxStyle {
  id: number;
  name: string;
  description: string | null;
  "max-char": number;
  model: string;
  image: string | null;
}

export interface SkyboxGeneration {
  id: number;
  status: "pending" | "dispatched" | "processing" | "complete" | "abort" | "error";
  file_url: string;
  thumb_url: string;
  depth_map_url: string;
  title: string;
  error_message: string | null;
  obfuscated_id: string;
  pusher_channel: string;
  pusher_event: string;
}

export async function getSkyboxStyles(): Promise<SkyboxStyle[]> {
  const res = await fetch(`${API_BASE}/skybox/styles`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`Failed to fetch styles: ${res.status}`);
  return res.json();
}

export async function generateSkybox(
  prompt: string,
  styleId: number = 89,
  enhancePrompt: boolean = true
): Promise<SkyboxGeneration> {
  const res = await fetch(`${API_BASE}/skybox`, {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      skybox_style_id: styleId,
      enhance_prompt: enhancePrompt,
    }),
  });
  if (!res.ok) throw new Error(`Failed to generate skybox: ${res.status}`);
  return res.json();
}

export async function getSkyboxById(id: number): Promise<SkyboxGeneration> {
  const res = await fetch(`${API_BASE}/imagine/requests/${id}`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`Failed to fetch skybox: ${res.status}`);
  return res.json();
}

export async function pollSkyboxUntilComplete(
  id: number,
  onProgress?: (status: string) => void,
  maxAttempts: number = 60,
  intervalMs: number = 3000
): Promise<SkyboxGeneration> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getSkyboxById(id);
    onProgress?.(result.status);

    if (result.status === "complete") return result;
    if (result.status === "error" || result.status === "abort") {
      throw new Error(`Skybox generation ${result.status}: ${result.error_message || "Unknown error"}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Skybox generation timed out");
}

// Pre-built arena prompts for quick generation
export const ARENA_PROMPTS = [
  {
    name: "Neon Colosseum",
    prompt: "Massive cyberpunk colosseum arena with neon cyan and magenta energy barriers, floating hexagonal platforms over a dark abyss, holographic scoreboards, particle effects, dark atmospheric fog with volumetric neon lighting, brutalist architecture",
    styleId: 89, // M3 Open World
  },
  {
    name: "Crypto Wasteland",
    prompt: "Post-apocalyptic desert wasteland with ruined blockchain server towers, glowing green data streams flowing through cracked earth, abandoned mining rigs, toxic neon fog, dark stormy sky with digital aurora",
    styleId: 146, // M3 Dystopian Render
  },
  {
    name: "Digital Void",
    prompt: "Abstract digital void space with floating geometric platforms, holographic grid floor extending to infinity, neon wireframe structures, data particles streaming upward, deep black space with cyan and magenta nebula",
    styleId: 148, // M3 Concept Render
  },
  {
    name: "Mech Hangar",
    prompt: "Industrial mech hangar bay with massive robotic suits in repair bays, sparking welding equipment, ammunition crates stacked high, neon warning lights, steam and smoke, brutalist concrete and steel architecture",
    styleId: 147, // M3 Detailed Render
  },
  {
    name: "Quantum Arena",
    prompt: "Quantum physics inspired arena with floating matter and antimatter platforms, particle accelerator rings glowing with energy, Schrodinger equation holographics, deep space background with quantum foam effects",
    styleId: 93, // M3 Scifi Concept Art
  },
];

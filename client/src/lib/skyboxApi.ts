// Skybox AI API Service — Now proxied through server-side tRPC
// API key is hidden server-side for security

export interface SkyboxStyle {
  id: number;
  name: string;
  model?: string;
}

export interface SkyboxGeneration {
  id: number;
  status: string;
  file_url: string;
  thumb_url: string;
  depth_map_url: string;
  title: string;
}

// These functions are kept for backward compatibility but now
// the Arena page should use tRPC hooks directly.
// We keep the ARENA_PROMPTS here for the quick-select UI.

// Pre-built arena prompts for quick generation
export const ARENA_PROMPTS = [
  {
    name: "Neon Colosseum",
    prompt: "Massive cyberpunk colosseum arena with neon cyan and magenta energy barriers, floating hexagonal platforms over a dark abyss, holographic scoreboards, particle effects, dark atmospheric fog with volumetric neon lighting, brutalist architecture",
    styleId: 89,
  },
  {
    name: "Crypto Wasteland",
    prompt: "Post-apocalyptic desert wasteland with ruined blockchain server towers, glowing green data streams flowing through cracked earth, abandoned mining rigs, toxic neon fog, dark stormy sky with digital aurora",
    styleId: 146,
  },
  {
    name: "Digital Void",
    prompt: "Abstract digital void space with floating geometric platforms, holographic grid floor extending to infinity, neon wireframe structures, data particles streaming upward, deep black space with cyan and magenta nebula",
    styleId: 148,
  },
  {
    name: "Mech Hangar",
    prompt: "Industrial mech hangar bay with massive robotic suits in repair bays, sparking welding equipment, ammunition crates stacked high, neon warning lights, steam and smoke, brutalist concrete and steel architecture",
    styleId: 147,
  },
  {
    name: "Quantum Arena",
    prompt: "Quantum physics inspired arena with floating matter and antimatter platforms, particle accelerator rings glowing with energy, Schrodinger equation holographics, deep space background with quantum foam effects",
    styleId: 93,
  },
];

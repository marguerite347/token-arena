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

// Re-export from shared module
export { ARENA_PROMPTS } from "@shared/arenaPrompts";

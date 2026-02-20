// Arena preset prompts — shared between client and server for skybox caching
// Using Blockade Labs Staging API (Model 4) style IDs
// Staging endpoint: https://backend-staging.blockadelabs.com/api/v1/
// Model 4 styles available: 172-188
export const ARENA_PROMPTS = [
  {
    name: "Neon Brutalism",
    prompt: "pov in the center of an expansive massive brutalist cyberpunk arena, neon glows in the misty rain, concrete walls covered in structures like circuit boards, lots of pipes and conduits surrounding the arena playfield, dramatic neon lighting, rain-slicked surfaces",
    styleId: 188, // M4 Cyberpunk
  },
  {
    name: "Neon Colosseum",
    prompt: "Massive cyberpunk colosseum arena with neon cyan and magenta energy barriers, floating hexagonal platforms over a dark abyss, holographic scoreboards, particle effects, dark atmospheric fog with volumetric neon lighting, brutalist architecture, sci-fi render",
    styleId: 177, // M4 Scifi Render A
  },
  {
    name: "Crypto Wasteland",
    prompt: "Post-apocalyptic desert wasteland with ruined blockchain server towers, glowing green data streams flowing through cracked earth, abandoned mining rigs, toxic neon fog, dark stormy sky with digital aurora, dystopian render",
    styleId: 178, // M4 Scifi Render B
  },
  {
    name: "Digital Void",
    prompt: "Abstract digital void space with floating geometric platforms, holographic grid floor extending to infinity, neon wireframe structures, data particles streaming upward, deep black space with cyan and magenta nebula, Unreal Engine cinematic quality",
    styleId: 186, // M4 UE Render
  },
  {
    name: "Mech Hangar",
    prompt: "Industrial mech hangar bay with massive robotic suits in repair bays, sparking welding equipment, ammunition crates stacked high, neon warning lights, steam and smoke, brutalist concrete and steel architecture, Octane render quality",
    styleId: 185, // M4 Octane Render
  },
];

// Model 4 style reference (Blockade Labs Staging API)
export const M4_STYLES = {
  TEST: 172,
  ANIME_SOFT: 173,
  ANIME_KAWAII: 174,
  CLASSIC_ANIME: 175,
  WATERCOLOR_FANTASY: 176,
  SCIFI_RENDER_A: 177,
  SCIFI_RENDER_B: 178,
  DARK_FANTASY: 179,
  OPENWORLD_GOLDEN: 180,
  MIRROR_SKY: 181,
  NATURE_PHOTO: 182,
  M4_BASE: 183,
  BLENDER_RENDER: 184,
  OCTANE_RENDER: 185,
  UE_RENDER: 186,
  ANIMATED_FILM: 187,
  CYBERPUNK: 188,
} as const;

/**
 * PostProcessing — Cinematic post-processing pipeline for Token Arena
 *
 * Effects:
 *  - UnrealBloom: Neon glow on projectiles, agents, arena elements
 *  - Glitch: Screen distortion on damage/hit
 *  - ChromaticAberration: Speed/dash effects
 *  - Vignette: Cinematic spectator view framing
 */
import * as THREE from "three";
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  GlitchEffect,
  BlendFunction,
  KernelSize,
} from "postprocessing";

export interface PostProcessingPipeline {
  composer: EffectComposer;
  bloom: BloomEffect;
  glitch: GlitchEffect;
  chromatic: ChromaticAberrationEffect;
  vignette: VignetteEffect;
  glitchPass: EffectPass;
}

/**
 * Initialize the full post-processing pipeline
 */
export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): PostProcessingPipeline {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
  });

  // Base render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Bloom — neon glow on emissive surfaces
  const bloom = new BloomEffect({
    blendFunction: BlendFunction.ADD,
    luminanceThreshold: 0.4,
    luminanceSmoothing: 0.3,
    intensity: 1.5,
    kernelSize: KernelSize.LARGE,
    mipmapBlur: true,
  });

  // Chromatic Aberration — subtle color fringing for cyberpunk feel
  const chromatic = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(0.001, 0.001),
    radialModulation: true,
    modulationOffset: 0.3,
  });

  // Vignette — darken edges for cinematic framing
  const vignette = new VignetteEffect({
    darkness: 0.5,
    offset: 0.3,
  });

  // Glitch — screen distortion (disabled by default, triggered on damage)
  const glitch = new GlitchEffect({
    delay: new THREE.Vector2(1.5, 3.5),
    duration: new THREE.Vector2(0.1, 0.3),
    strength: new THREE.Vector2(0.1, 0.3),
    columns: 0.05,
    ratio: 0.85,
  });

  // Combine bloom + chromatic + vignette in one pass
  const mainEffectsPass = new EffectPass(camera, bloom, chromatic, vignette);
  composer.addPass(mainEffectsPass);

  // Glitch in separate pass (so we can enable/disable independently)
  const glitchPass = new EffectPass(camera, glitch);
  glitchPass.enabled = false; // disabled by default
  composer.addPass(glitchPass);

  return { composer, bloom, glitch, chromatic, vignette, glitchPass };
}

/**
 * Trigger a brief glitch effect (e.g., on taking damage)
 */
export function triggerGlitch(pipeline: PostProcessingPipeline, durationMs = 200): void {
  pipeline.glitchPass.enabled = true;
  setTimeout(() => {
    pipeline.glitchPass.enabled = false;
  }, durationMs);
}

/**
 * Set bloom intensity (e.g., increase during combat, decrease in menu)
 */
export function setBloomIntensity(pipeline: PostProcessingPipeline, intensity: number): void {
  pipeline.bloom.intensity = intensity;
}

/**
 * Set chromatic aberration offset (e.g., increase during speed boost)
 */
export function setChromaticOffset(pipeline: PostProcessingPipeline, amount: number): void {
  pipeline.chromatic.offset.set(amount, amount);
}

/**
 * Resize the composer when the window changes size
 */
export function resizePostProcessing(pipeline: PostProcessingPipeline, width: number, height: number): void {
  pipeline.composer.setSize(width, height);
}

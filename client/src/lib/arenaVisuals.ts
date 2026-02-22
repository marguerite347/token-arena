/**
 * ArenaVisuals — Enhanced arena environment for Token Arena
 *
 * Replaces the basic grid + ring + pillars with:
 *  - Animated pulse grid floor with wave effects
 *  - Holographic arena pillars with scanline material
 *  - Neon arena boundary ring with glow
 *  - Dynamic combat-reactive lighting
 */
import * as THREE from "three";
import { createHolographicMaterial, updateHolographicMaterial } from "./holographicMaterial";

// ─── Animated Grid Floor ────────────────────────────────────────────────────

const GRID_VERTEX = `
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;

  void main() {
    vUv = uv;
    vPos = position;

    // Subtle wave displacement
    vec3 pos = position;
    float wave = sin(pos.x * 0.5 + uTime * 0.8) * cos(pos.z * 0.5 + uTime * 0.6) * 0.05;
    pos.y += wave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GRID_FRAGMENT = `
  varying vec2 vUv;
  varying vec3 vPos;
  uniform float uTime;
  uniform vec3 uPulseOrigin;
  uniform float uPulseTime;
  uniform vec3 uBaseColor;

  void main() {
    // Grid lines
    vec2 grid = abs(fract(vPos.xz * 0.5) - 0.5);
    float line = min(grid.x, grid.y);
    float gridAlpha = 1.0 - smoothstep(0.0, 0.04, line);

    // Distance-based fade
    float dist = length(vPos.xz);
    float fade = 1.0 - smoothstep(15.0, 20.0, dist);

    // Pulse wave from combat events
    float pulseDist = length(vPos.xz - uPulseOrigin.xz);
    float pulseAge = uTime - uPulseTime;
    float pulseWave = 0.0;
    if (pulseAge < 2.0 && pulseAge > 0.0) {
      float pulseRadius = pulseAge * 10.0;
      pulseWave = exp(-abs(pulseDist - pulseRadius) * 2.0) * (1.0 - pulseAge / 2.0);
    }

    // Scanning line
    float scan = smoothstep(0.0, 0.3, abs(sin(vPos.x * 0.1 + uTime * 2.0)));

    // Combine
    vec3 color = uBaseColor * (gridAlpha * 0.4 + 0.05);
    color += uBaseColor * pulseWave * 2.0;
    color += vec3(0.0, 1.0, 0.6) * scan * gridAlpha * 0.1;

    float alpha = (gridAlpha * 0.3 + 0.02 + pulseWave * 0.5) * fade;

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface ArenaElements {
  gridFloor: THREE.Mesh;
  gridMaterial: THREE.ShaderMaterial;
  arenaRing: THREE.Mesh;
  ringMaterial: THREE.ShaderMaterial;
  pillars: THREE.Group;
  pillarMaterials: THREE.ShaderMaterial[];
  combatLights: THREE.PointLight[];
}

/**
 * Create the enhanced arena environment
 */
export function createArenaVisuals(scene: THREE.Scene): ArenaElements {
  // ─── Animated Grid Floor ──────────────────────────────────────────
  const gridMaterial = new THREE.ShaderMaterial({
    vertexShader: GRID_VERTEX,
    fragmentShader: GRID_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uPulseOrigin: { value: new THREE.Vector3(0, 0, 0) },
      uPulseTime: { value: -10 },
      uBaseColor: { value: new THREE.Color(0x00f0ff) },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const gridFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50, 100, 100),
    gridMaterial
  );
  gridFloor.rotation.x = -Math.PI / 2;
  gridFloor.position.y = -0.01;
  scene.add(gridFloor);

  // ─── Neon Arena Ring ──────────────────────────────────────────────
  const ringMaterial = createHolographicMaterial({
    color: "#00f0ff",
    scanlineSize: 12,
    brightness: 1.5,
    fresnelAmount: 0.8,
    opacity: 0.4,
    signalSpeed: 1.0,
  });

  const arenaRing = new THREE.Mesh(
    new THREE.TorusGeometry(19.5, 0.15, 8, 128),
    ringMaterial
  );
  arenaRing.rotation.x = Math.PI / 2;
  arenaRing.position.y = 0.15;
  scene.add(arenaRing);

  // ─── Holographic Pillars ──────────────────────────────────────────
  const pillars = new THREE.Group();
  const pillarMaterials: THREE.ShaderMaterial[] = [];
  const pillarColors = [
    "#00f0ff", "#ff00aa", "#39ff14", "#7b2fff",
    "#00f0ff", "#ff00aa", "#39ff14", "#7b2fff",
  ];

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const px = Math.cos(angle) * 18;
    const pz = Math.sin(angle) * 18;

    const pillarMat = createHolographicMaterial({
      color: pillarColors[i],
      scanlineSize: 6,
      brightness: 1.3,
      fresnelAmount: 0.6,
      opacity: 0.7,
      signalSpeed: 0.3 + i * 0.1,
    });
    pillarMaterials.push(pillarMat);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5, 8),
      pillarMat
    );
    pillar.position.set(px, 2.5, pz);
    pillars.add(pillar);

    // Pillar cap glow
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      pillarMat.clone()
    );
    cap.position.set(px, 5.1, pz);
    pillars.add(cap);

    // Pillar point light
    const light = new THREE.PointLight(new THREE.Color(pillarColors[i]), 0.3, 8);
    light.position.set(px, 5.2, pz);
    pillars.add(light);
  }
  scene.add(pillars);

  // ─── Combat-Reactive Lights ───────────────────────────────────────
  const combatLights: THREE.PointLight[] = [];

  const mainLight = new THREE.PointLight(0x00f0ff, 2, 40);
  mainLight.position.set(0, 8, 0);
  scene.add(mainLight);
  combatLights.push(mainLight);

  const accentLight1 = new THREE.PointLight(0xff00aa, 1.5, 30);
  accentLight1.position.set(10, 6, 10);
  scene.add(accentLight1);
  combatLights.push(accentLight1);

  const accentLight2 = new THREE.PointLight(0x39ff14, 1.5, 30);
  accentLight2.position.set(-10, 6, -10);
  scene.add(accentLight2);
  combatLights.push(accentLight2);

  return {
    gridFloor,
    gridMaterial,
    arenaRing,
    ringMaterial,
    pillars,
    pillarMaterials,
    combatLights,
  };
}

/**
 * Trigger a grid pulse from a combat event (hit, kill, explosion)
 */
export function triggerArenaPulse(
  arena: ArenaElements,
  origin: THREE.Vector3,
  time: number
): void {
  arena.gridMaterial.uniforms.uPulseOrigin.value.copy(origin);
  arena.gridMaterial.uniforms.uPulseTime.value = time;
}

/**
 * Flash combat lights on a kill event
 */
export function flashCombatLights(arena: ArenaElements, color: number, intensity = 4): void {
  const c = new THREE.Color(color);
  arena.combatLights.forEach(light => {
    const origColor = light.color.clone();
    const origIntensity = light.intensity;
    light.color.copy(c);
    light.intensity = intensity;

    // Fade back over 500ms
    const start = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - start) / 500);
      light.color.lerpColors(c, origColor, t);
      light.intensity = intensity + (origIntensity - intensity) * t;
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  });
}

/**
 * Update arena visuals — call each frame
 */
export function updateArenaVisuals(arena: ArenaElements, dt: number, totalTime: number): void {
  // Update grid floor time
  arena.gridMaterial.uniforms.uTime.value = totalTime;

  // Update holographic ring
  updateHolographicMaterial(arena.ringMaterial, dt);

  // Update holographic pillars
  arena.pillarMaterials.forEach(mat => updateHolographicMaterial(mat, dt));
}

/**
 * Dispose all arena visual resources
 */
export function disposeArenaVisuals(arena: ArenaElements, scene: THREE.Scene): void {
  scene.remove(arena.gridFloor);
  arena.gridFloor.geometry.dispose();
  arena.gridMaterial.dispose();

  scene.remove(arena.arenaRing);
  arena.arenaRing.geometry.dispose();
  arena.ringMaterial.dispose();

  arena.pillars.traverse((child) => {
    if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    const mat = (child as THREE.Mesh).material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else (mat as THREE.Material).dispose();
    }
  });
  scene.remove(arena.pillars);

  arena.combatLights.forEach(light => scene.remove(light));
}

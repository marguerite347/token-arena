/**
 * AgentModels — Animated 3D character loader for Token Arena agents
 *
 * Loads GLB models from CDN, applies per-agent color tinting,
 * and manages animation mixers for idle/walk/run/attack/death states.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// CDN URLs for Three.js example models
const MODEL_URLS = {
  robot: "https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb",
  soldier: "https://threejs.org/examples/models/gltf/Soldier.glb",
  xbot: "https://threejs.org/examples/models/gltf/Xbot.glb",
};

export type AgentModelType = keyof typeof MODEL_URLS;
export type AgentAnimState = "idle" | "walk" | "run" | "attack" | "death" | "victory";

interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

interface AgentModelInstance {
  group: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  currentAction: string | null;
  healthBar: THREE.Mesh;
  healthBarBg: THREE.Mesh;
  nameTag: THREE.Mesh;
  glowLight: THREE.PointLight;
}

// Cache loaded models to avoid re-downloading
const modelCache = new Map<string, LoadedModel>();
const loader = new GLTFLoader();

/**
 * Preload a model into cache
 */
export async function preloadModel(type: AgentModelType = "robot"): Promise<void> {
  if (modelCache.has(type)) return;

  return new Promise((resolve, reject) => {
    loader.load(
      MODEL_URLS[type],
      (gltf: GLTF) => {
        modelCache.set(type, {
          scene: gltf.scene,
          animations: gltf.animations,
        });
        resolve();
      },
      undefined,
      reject
    );
  });
}

/**
 * Create an agent model instance with color tinting and animation support
 */
export function createAgentModel(
  agentColor: string | number,
  agentName: string,
  modelType: AgentModelType = "robot"
): AgentModelInstance | null {
  const cached = modelCache.get(modelType);
  if (!cached) {
    console.warn(`[AgentModels] Model "${modelType}" not preloaded. Call preloadModel() first.`);
    return null;
  }

  // Clone the model
  const group = new THREE.Group();
  const model = cached.scene.clone();

  // Scale appropriately
  const scaleMap: Record<AgentModelType, number> = {
    robot: 0.7,
    soldier: 0.9,
    xbot: 0.008,
  };
  model.scale.setScalar(scaleMap[modelType] || 1.0);

  // Apply color tint to all mesh materials
  const color = new THREE.Color(agentColor);
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
        // Tint the emissive to agent color for glow
        mat.emissive = color.clone().multiplyScalar(0.3);
        mat.emissiveIntensity = 0.5;
        // Slight color overlay
        if (mat.color) {
          mat.color.lerp(color, 0.2);
        }
        mesh.material = mat;
      }
    }
  });

  group.add(model);

  // Set up animation mixer
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map<string, THREE.AnimationAction>();

  // Map animation names (varies by model)
  for (const clip of cached.animations) {
    const name = clip.name.toLowerCase();
    const action = mixer.clipAction(clip);

    // Map common animation names
    if (name.includes("idle") || name === "idle") actions.set("idle", action);
    else if (name.includes("walk") || name === "walking") actions.set("walk", action);
    else if (name.includes("run") || name === "running") actions.set("run", action);
    else if (name.includes("punch") || name.includes("attack")) actions.set("attack", action);
    else if (name.includes("death") || name.includes("die")) actions.set("death", action);
    else if (name.includes("dance") || name.includes("victory") || name.includes("wave")) actions.set("victory", action);

    // Store all by original name too
    actions.set(name, action);
  }

  // Start with idle
  const idleAction = actions.get("idle");
  if (idleAction) {
    idleAction.play();
  }

  // Health bar background
  const healthBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 })
  );
  healthBarBg.position.y = 2.4;
  healthBarBg.name = "hb-bg";
  group.add(healthBarBg);

  // Health bar fill
  const healthBar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.98, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x39ff14 })
  );
  healthBar.position.y = 2.4;
  healthBar.position.z = 0.001;
  healthBar.name = "hb";
  group.add(healthBar);

  // Name tag
  const nameTag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
  );
  nameTag.position.y = 2.65;
  nameTag.name = "nametag";
  group.add(nameTag);

  // Glow light
  const glowLight = new THREE.PointLight(color, 0.6, 6);
  glowLight.position.y = 1.2;
  group.add(glowLight);

  return {
    group,
    mixer,
    actions,
    currentAction: "idle",
    healthBar,
    healthBarBg,
    nameTag,
    glowLight,
  };
}

/**
 * Transition to a new animation state with crossfade
 */
export function setAgentAnimation(
  instance: AgentModelInstance,
  state: AgentAnimState,
  crossfadeDuration = 0.3
): void {
  if (instance.currentAction === state) return;

  const newAction = instance.actions.get(state);
  if (!newAction) return;

  const oldAction = instance.currentAction ? instance.actions.get(instance.currentAction) : null;

  if (state === "death") {
    newAction.setLoop(THREE.LoopOnce, 1);
    newAction.clampWhenFinished = true;
  } else if (state === "attack") {
    newAction.setLoop(THREE.LoopOnce, 1);
    newAction.clampWhenFinished = false;
  } else {
    newAction.setLoop(THREE.LoopRepeat, Infinity);
  }

  newAction.reset();
  newAction.play();

  if (oldAction) {
    oldAction.crossFadeTo(newAction, crossfadeDuration, true);
  }

  instance.currentAction = state;
}

/**
 * Update agent model — call each frame
 */
export function updateAgentModel(
  instance: AgentModelInstance,
  dt: number,
  camera: THREE.Camera,
  health: number,
  maxHealth: number,
  isMoving: boolean,
  isFiring: boolean
): void {
  // Update animation mixer
  instance.mixer.update(dt);

  // Auto-set animation based on state
  if (isFiring && instance.currentAction !== "attack") {
    setAgentAnimation(instance, "attack", 0.1);
  } else if (isMoving && instance.currentAction !== "run" && !isFiring) {
    setAgentAnimation(instance, "run", 0.2);
  } else if (!isMoving && !isFiring && instance.currentAction !== "idle") {
    setAgentAnimation(instance, "idle", 0.3);
  }

  // Update health bar
  const pct = health / maxHealth;
  instance.healthBar.scale.x = Math.max(0.01, pct);
  instance.healthBar.position.x = -(1 - pct) * 0.49;
  (instance.healthBar.material as THREE.MeshBasicMaterial).color.setHex(
    pct > 0.5 ? 0x39ff14 : pct > 0.25 ? 0xffb800 : 0xff3333
  );

  // Billboard health bar and name tag toward camera
  instance.healthBarBg.lookAt(camera.position);
  instance.healthBar.lookAt(camera.position);
  instance.nameTag.lookAt(camera.position);

  // Pulse glow light based on health
  instance.glowLight.intensity = 0.4 + (1 - pct) * 0.6;
}

/**
 * Dispose an agent model instance
 */
export function disposeAgentModel(instance: AgentModelInstance, scene: THREE.Scene): void {
  instance.mixer.stopAllAction();
  instance.group.traverse((child) => {
    if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    const mat = (child as THREE.Mesh).material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else (mat as THREE.Material).dispose();
    }
  });
  scene.remove(instance.group);
}

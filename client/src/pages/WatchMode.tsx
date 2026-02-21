/*
 * WatchMode — Immersive 3D Spectator Experience
 * 
 * Full-viewport Three.js scene with:
 * - Equirectangular Skybox AI panorama (Blockade Labs) as arena environment
 * - Post-processing: Bloom, ChromaticAberration, Vignette, Noise
 * - 3D agent characters with distinct visual identities
 * - Weapon fire particle effects (plasma, railgun, scatter, rocket, laser, void)
 * - Cinematic camera with GSAP animations
 * - Holographic HUD overlay (health bars, kill feed, terminal, chat)
 * - Auto-play FFA tournament
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  ChromaticAberrationEffect,
  VignetteEffect,
  NoiseEffect,
  BlendFunction,
} from "postprocessing";
import gsap from "gsap";

// ─── CDN-hosted Skybox AI panoramic images (4096x2048 equirectangular) ──────
const SKYBOX_PANORAMAS = [
  { name: "Cyberpunk Arena", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/gyluRUvZGNaXfxyf.jpg" },
  { name: "Neon Brutalism", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/sNuAtMqlxnNqsqEE.jpg" },
  { name: "Mech Hangar", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/gOkcBobLWwNqWJlr.jpg" },
  { name: "Crypto Wasteland", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/dRjHDiDQqVzLFNjG.jpg" },
  { name: "SciFi Battleground", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/tVCUBUdNNPwxMTvN.jpg" },
  { name: "UE Render Arena", url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/ybRsYGSbEaljmdEq.jpg" },
];

// ─── Agent character definitions ────────────────────────────────────────────
const AGENT_CHARS: Record<
  string,
  { color: number; emissive: number; label: string; scale: number; shape: string }
> = {
  "NEXUS-7": { color: 0x00ffff, emissive: 0x003333, label: "NEXUS-7", scale: 1.0, shape: "robot" },
  "PHANTOM": { color: 0x00ff88, emissive: 0x003322, label: "PHANTOM", scale: 1.1, shape: "soldier" },
  "TITAN": { color: 0xaa44ff, emissive: 0x220044, label: "TITAN", scale: 1.4, shape: "beast" },
  "CIPHER": { color: 0x4488ff, emissive: 0x002244, label: "CIPHER", scale: 1.2, shape: "mech" },
  "AURORA": { color: 0x44ffdd, emissive: 0x003333, label: "AURORA", scale: 0.9, shape: "speeder" },
  "WRAITH": { color: 0xff44aa, emissive: 0x330022, label: "WRAITH", scale: 1.0, shape: "ghost" },
};

const WEAPON_COLORS: Record<string, number> = {
  "Plasma Pistol": 0x00ffff,
  Railgun: 0xaa44ff,
  "Scatter Blaster": 0xff4444,
  "Rocket Launcher": 0xff8800,
  "Laser Rifle": 0x44ff44,
  "Void Cannon": 0xff44ff,
};

// ─── Types ──────────────────────────────────────────────────────────────────
interface AgentHUD {
  agentId: string;
  name: string;
  hp: number;
  maxHp: number;
  kills: number;
  tokens: number;
  alive: boolean;
}
interface TermLine {
  type: "call" | "response" | "system" | "error";
  text: string;
  ts: number;
}
interface ChatMsg {
  sender: string;
  color: string;
  text: string;
  ts: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createAgentMesh(
  shape: string,
  color: number,
  emissive: number,
  scale: number
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    roughness: 0.3,
    metalness: 0.8,
    transparent: true,
    opacity: 0.95,
  });

  switch (shape) {
    case "robot": {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), mat);
      body.position.y = 0.6;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), mat);
      head.position.y = 1.2;
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06), eyeMat);
      eyeL.position.set(-0.1, 1.25, 0.2);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06), eyeMat);
      eyeR.position.set(0.1, 1.25, 0.2);
      group.add(body, head, eyeL, eyeR);
      break;
    }
    case "soldier": {
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), mat);
      torso.position.y = 0.6;
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
      helmet.position.y = 1.2;
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.1, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      visor.position.set(0, 1.2, 0.25);
      group.add(torso, helmet, visor);
      break;
    }
    case "beast": {
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat);
      core.position.y = 0.7;
      for (let i = 0; i < 6; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), mat);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(
          Math.cos(angle) * 0.5,
          0.7 + Math.sin(angle * 2) * 0.2,
          Math.sin(angle) * 0.5
        );
        spike.lookAt(core.position);
        spike.rotateX(Math.PI);
        group.add(spike);
      }
      const eyes = new THREE.Mesh(
        new THREE.SphereGeometry(0.12),
        new THREE.MeshBasicMaterial({ color: 0xff0000 })
      );
      eyes.position.set(0, 0.9, 0.4);
      group.add(core, eyes);
      break;
    }
    case "mech": {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), mat);
      chassis.position.y = 0.4;
      const turret = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.3, 6),
        mat
      );
      turret.position.y = 0.8;
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8),
        mat
      );
      barrel.position.set(0, 0.8, 0.35);
      barrel.rotateX(Math.PI / 2);
      group.add(chassis, turret, barrel);
      break;
    }
    case "speeder": {
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 8), mat);
      hull.position.y = 0.5;
      hull.rotateZ(Math.PI / 6);
      const wing1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.3), mat);
      wing1.position.set(0, 0.5, 0);
      group.add(hull, wing1);
      break;
    }
    case "ghost": {
      const ghostMat = mat.clone();
      ghostMat.transparent = true;
      ghostMat.opacity = 0.6;
      const form = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), ghostMat);
      form.position.y = 0.8;
      form.scale.y = 1.4;
      for (let i = 0; i < 3; i++) {
        const trail = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.5, 4),
          ghostMat
        );
        trail.position.set(
          Math.sin(i * 2.1) * 0.2,
          0.2,
          Math.cos(i * 2.1) * 0.2
        );
        group.add(trail);
      }
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.08),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      eye.position.set(0, 0.9, 0.3);
      group.add(form, eye);
      break;
    }
  }

  group.scale.setScalar(scale);
  return group;
}

// ─── Weapon projectile factory ──────────────────────────────────────────────
function createProjectile(
  scene: THREE.Scene,
  from: THREE.Vector3,
  to: THREE.Vector3,
  weapon: string,
  onComplete: () => void
) {
  const color = WEAPON_COLORS[weapon] || 0xffffff;

  switch (weapon) {
    case "Plasma Pistol": {
      const geo = new THREE.SphereGeometry(0.08, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const bolt = new THREE.Mesh(geo, mat);
      bolt.position.copy(from);
      const spriteMat = new THREE.SpriteMaterial({
        color,
        transparent: true,
        opacity: 0.4,
      });
      const glow = new THREE.Sprite(spriteMat);
      glow.scale.setScalar(0.4);
      bolt.add(glow);
      scene.add(bolt);
      gsap.to(bolt.position, {
        x: to.x,
        y: to.y,
        z: to.z,
        duration: 0.6,
        ease: "power2.in",
        onComplete: () => {
          scene.remove(bolt);
          onComplete();
        },
      });
      break;
    }
    case "Railgun": {
      const dir = to.clone().sub(from);
      const len = dir.length();
      const geo = new THREE.CylinderGeometry(0.02, 0.02, len, 8);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, len / 2);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const beam = new THREE.Mesh(geo, mat);
      beam.position.copy(from);
      beam.lookAt(to);
      scene.add(beam);
      const glowGeo = new THREE.CylinderGeometry(0.06, 0.06, len, 8);
      glowGeo.rotateX(Math.PI / 2);
      glowGeo.translate(0, 0, len / 2);
      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3,
      });
      const glowBeam = new THREE.Mesh(glowGeo, glowMat);
      glowBeam.position.copy(from);
      glowBeam.lookAt(to);
      scene.add(glowBeam);
      gsap.to(mat, { opacity: 0, duration: 0.5, delay: 0.1 });
      gsap.to(glowMat, {
        opacity: 0,
        duration: 0.5,
        delay: 0.1,
        onComplete: () => {
          scene.remove(beam);
          scene.remove(glowBeam);
          onComplete();
        },
      });
      break;
    }
    case "Scatter Blaster": {
      for (let i = 0; i < 8; i++) {
        const spread = new THREE.Vector3(
          to.x + (Math.random() - 0.5) * 1.5,
          to.y + (Math.random() - 0.5) * 0.5,
          to.z + (Math.random() - 0.5) * 1.5
        );
        const p = new THREE.Mesh(
          new THREE.SphereGeometry(0.04),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
        );
        p.position.copy(from);
        scene.add(p);
        gsap.to(p.position, {
          x: spread.x,
          y: spread.y,
          z: spread.z,
          duration: 0.4,
          ease: "power1.out",
          onComplete: () => { scene.remove(p); },
        });
      }
      setTimeout(onComplete, 400);
      break;
    }
    case "Rocket Launcher": {
      const rocket = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.2, 6),
        new THREE.MeshBasicMaterial({ color })
      );
      rocket.position.copy(from);
      scene.add(rocket);
      const trailInterval = setInterval(() => {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 + Math.random() * 0.05),
          new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.5,
          })
        );
        smoke.position.copy(rocket.position);
        scene.add(smoke);
        gsap.to(smoke.material as THREE.MeshBasicMaterial, {
          opacity: 0,
          duration: 0.8,
          onComplete: () => { scene.remove(smoke); },
        });
        gsap.to(smoke.scale, { x: 2, y: 2, z: 2, duration: 0.8 });
      }, 50);
      gsap.to(rocket.position, {
        x: to.x,
        y: to.y,
        z: to.z,
        duration: 0.7,
        ease: "power2.in",
        onComplete: () => {
          clearInterval(trailInterval);
          scene.remove(rocket);
          const explosion = new THREE.Mesh(
            new THREE.SphereGeometry(0.5),
            new THREE.MeshBasicMaterial({
              color: 0xff4400,
              transparent: true,
              opacity: 0.8,
            })
          );
          explosion.position.copy(to);
          scene.add(explosion);
          gsap.to(explosion.scale, { x: 3, y: 3, z: 3, duration: 0.4 });
          gsap.to(explosion.material as THREE.MeshBasicMaterial, {
            opacity: 0,
            duration: 0.4,
            onComplete: () => {
              scene.remove(explosion);
              onComplete();
            },
          });
        },
      });
      rocket.lookAt(to);
      break;
    }
    case "Laser Rifle": {
      const dir2 = to.clone().sub(from);
      const len2 = dir2.length();
      const beamGeo = new THREE.CylinderGeometry(0.01, 0.01, len2, 4);
      beamGeo.rotateX(Math.PI / 2);
      beamGeo.translate(0, 0, len2 / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const laserBeam = new THREE.Mesh(beamGeo, beamMat);
      laserBeam.position.copy(from);
      laserBeam.lookAt(to);
      scene.add(laserBeam);
      gsap.to(beamMat, {
        opacity: 0.3,
        duration: 0.1,
        yoyo: true,
        repeat: 4,
        onComplete: () => {
          scene.remove(laserBeam);
          onComplete();
        },
      });
      break;
    }
    case "Void Cannon": {
      const voidSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0x220033,
          transparent: true,
          opacity: 0.9,
        })
      );
      voidSphere.position.copy(from);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.03, 8, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
      );
      ring.position.copy(from);
      scene.add(voidSphere, ring);
      gsap.to(voidSphere.position, {
        x: to.x,
        y: to.y,
        z: to.z,
        duration: 0.8,
        ease: "power1.inOut",
      });
      gsap.to(ring.position, {
        x: to.x,
        y: to.y,
        z: to.z,
        duration: 0.8,
        ease: "power1.inOut",
      });
      gsap.to(ring.rotation, { z: Math.PI * 4, duration: 0.8 });
      setTimeout(() => {
        gsap.to(voidSphere.scale, { x: 4, y: 4, z: 4, duration: 0.3 });
        gsap.to(voidSphere.material as THREE.MeshBasicMaterial, {
          opacity: 0,
          duration: 0.3,
          onComplete: () => {
            scene.remove(voidSphere);
            scene.remove(ring);
            onComplete();
          },
        });
      }, 800);
      break;
    }
    default: {
      const defaultBolt = new THREE.Mesh(
        new THREE.SphereGeometry(0.06),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      defaultBolt.position.copy(from);
      scene.add(defaultBolt);
      gsap.to(defaultBolt.position, {
        x: to.x,
        y: to.y,
        z: to.z,
        duration: 0.5,
        onComplete: () => {
          scene.remove(defaultBolt);
          onComplete();
        },
      });
    }
  }
}

// ─── Damage number popup ────────────────────────────────────────────────────
function showDamageNumber(
  scene: THREE.Scene,
  position: THREE.Vector3,
  damage: number,
  color: number
) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 40px monospace";
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.strokeText(`-${damage}`, 64, 45);
  ctx.fillText(`-${damage}`, 64, 45);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 1 })
  );
  sprite.position.copy(position).add(new THREE.Vector3(0, 1.8, 0));
  sprite.scale.set(0.8, 0.4, 1);
  scene.add(sprite);
  gsap.to(sprite.position, {
    y: position.y + 3,
    duration: 1.2,
    ease: "power2.out",
  });
  gsap.to(sprite.material, {
    opacity: 0,
    duration: 1.2,
    onComplete: () => {
      scene.remove(sprite);
      tex.dispose();
    },
  });
}

// ─── Agent name label sprite ────────────────────────────────────────────────
function createNameLabel(name: string, color: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = 4;
  ctx.textAlign = "center";
  ctx.strokeText(name, 128, 40);
  ctx.fillText(name, 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true })
  );
  sprite.scale.set(1.5, 0.4, 1);
  sprite.position.y = 2.0;
  return sprite;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function WatchMode() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const agentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const skyboxSphereRef = useRef<THREE.Mesh | null>(null);
  const animFrameRef = useRef<number>(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const dustRef = useRef<THREE.Points | null>(null);
  const pointLightsRef = useRef<THREE.PointLight[]>([]);
  const combatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const arenaRingRef = useRef<THREE.Mesh | null>(null);

  // State
  const [phase, setPhase] = useState<
    "idle" | "loading" | "combat" | "debrief"
  >("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [agentStates, setAgentStates] = useState<AgentHUD[]>([]);
  const [terminalLines, setTerminalLines] = useState<TermLine[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [killFeed, setKillFeed] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [followAgent, setFollowAgent] = useState<string | null>(null);
  const [sessionResult, setSessionResult] = useState<any>(null);
  const [skyboxLoaded, setSkyboxLoaded] = useState(false);
  const [arenaName, setArenaName] = useState("");

  const termRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Push helpers
  const pushTerminal = useCallback((type: TermLine["type"], text: string) => {
    setTerminalLines((prev) => [
      ...prev.slice(-80),
      { type, text, ts: Date.now() },
    ]);
  }, []);
  const pushChat = useCallback(
    (sender: string, color: string, text: string) => {
      setChatMessages((prev) => [
        ...prev.slice(-50),
        { sender, color, text, ts: Date.now() },
      ]);
    },
    []
  );
  const pushKill = useCallback((text: string) => {
    setKillFeed((prev) => [...prev.slice(-5), text]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminalLines]);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages]);

  // ─── Load a random skybox panorama from CDN ──────────────────────────
  const loadSkybox = useCallback(
    (panorama?: (typeof SKYBOX_PANORAMAS)[0]) => {
      const chosen =
        panorama ||
        SKYBOX_PANORAMAS[Math.floor(Math.random() * SKYBOX_PANORAMAS.length)];
      setArenaName(chosen.name);

      const proxyUrl = `/api/skybox-proxy?url=${encodeURIComponent(chosen.url)}`;
      const loader = new THREE.TextureLoader();
      loader.crossOrigin = "anonymous";
      loader.load(
        proxyUrl,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          if (skyboxSphereRef.current) {
            const mat =
              skyboxSphereRef.current.material as THREE.MeshBasicMaterial;
            if (mat.map) mat.map.dispose();
            mat.map = texture;
            mat.needsUpdate = true;
          }
          if (sceneRef.current) {
            sceneRef.current.environment = texture;
          }
          setSkyboxLoaded(true);
        },
        undefined,
        (err) => {
          console.error("[Skybox] Load failed:", err);
        }
      );
    },
    []
  );

  // ─── tRPC mutation ────────────────────────────────────────────────────
  const ffaPlaytest = trpc.flywheel.ffa.useMutation({
    onSuccess: (data: any) => {
      if (combatIntervalRef.current) {
        clearInterval(combatIntervalRef.current);
        combatIntervalRef.current = null;
      }
      setPhase("debrief");
      setIsRunning(false);
      setSessionResult(data);
      pushTerminal(
        "system",
        `[SESSION COMPLETE] ${data.matchesPlayed} matches played`
      );
      pushChat(
        "SYSTEM",
        "#fbbf24",
        `Tournament complete! MVP: ${data.summary?.mvp || "Unknown"}`
      );
    },
    onError: (err: any) => {
      if (combatIntervalRef.current) {
        clearInterval(combatIntervalRef.current);
        combatIntervalRef.current = null;
      }
      setPhase("idle");
      setIsRunning(false);
      pushTerminal("error", `[ERROR] ${err.message}`);
    },
  });

  // ─── Three.js Scene Setup ────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 10);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.maxDistance = 18;
    controls.minDistance = 2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controlsRef.current = controls;

    // ─── Skybox Sphere ──────────────────────────────────────────────────
    const skyGeo = new THREE.SphereGeometry(100, 64, 64);
    skyGeo.scale(-1, 1, 1);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.FrontSide,
    });
    const skySphere = new THREE.Mesh(skyGeo, skyMat);
    skySphere.renderOrder = -1; // render first
    skySphere.frustumCulled = false;
    // Skybox should not be affected by fog
    skyMat.fog = false;
    scene.add(skySphere);
    skyboxSphereRef.current = skySphere;

    // ─── Lighting ───────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x334466, 0.8);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0x88aaff, 1.2);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);
    const pointCyan = new THREE.PointLight(0x00ffff, 2, 20);
    pointCyan.position.set(-5, 3, -5);
    scene.add(pointCyan);
    const pointPink = new THREE.PointLight(0xff44aa, 2, 20);
    pointPink.position.set(5, 3, 5);
    scene.add(pointPink);
    const pointPurple = new THREE.PointLight(0xaa44ff, 1.5, 15);
    pointPurple.position.set(0, 6, 0);
    scene.add(pointPurple);
    pointLightsRef.current = [pointCyan, pointPink, pointPurple];

    // ─── Arena floor grid ───────────────────────────────────────────────
    const gridHelper = new THREE.GridHelper(30, 30, 0x00ffff, 0x112233);
    gridHelper.position.y = -0.01;
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.25;
    scene.add(gridHelper);

    // ─── Arena boundary ring ────────────────────────────────────────────
    const ringGeo = new THREE.TorusGeometry(7, 0.03, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.4,
    });
    const arenaRing = new THREE.Mesh(ringGeo, ringMat);
    arenaRing.rotation.x = Math.PI / 2;
    arenaRing.position.y = 0.01;
    scene.add(arenaRing);
    arenaRingRef.current = arenaRing;

    // ─── Ambient dust particles ─────────────────────────────────────────
    const dustCount = 600;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 40;
      dustPositions[i * 3 + 1] = Math.random() * 12;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      const c = new THREE.Color().setHSL(
        0.55 + Math.random() * 0.1,
        0.8,
        0.6
      );
      dustColors[i * 3] = c.r;
      dustColors[i * 3 + 1] = c.g;
      dustColors[i * 3 + 2] = c.b;
    }
    dustGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(dustPositions, 3)
    );
    dustGeo.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.04,
      transparent: true,
      opacity: 0.5,
      vertexColors: true,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);
    dustRef.current = dust;

    // ─── Post-processing pipeline ───────────────────────────────────────
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomEffect = new BloomEffect({
      intensity: 1.5,
      luminanceThreshold: 0.3,
      luminanceSmoothing: 0.7,
      mipmapBlur: true,
    });
    const chromaticEffect = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.001, 0.001),
      radialModulation: false,
      modulationOffset: 0.0,
    });
    const vignetteEffect = new VignetteEffect({
      darkness: 0.6,
      offset: 0.3,
    });
    const noiseEffect = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
    });
    noiseEffect.blendMode.opacity.value = 0.06;

    const effectPass = new EffectPass(
      camera,
      bloomEffect,
      chromaticEffect,
      vignetteEffect,
      noiseEffect
    );
    composer.addPass(effectPass);
    composerRef.current = composer;

    // ─── Animation loop ─────────────────────────────────────────────────
    lastTimeRef.current = performance.now();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      elapsedRef.current += delta;
      const elapsed = elapsedRef.current;

      controls.update();

      // Animate dust
      if (dustRef.current) {
        const positions = dustRef.current.geometry.attributes.position
          .array as Float32Array;
        for (let i = 0; i < dustCount; i++) {
          positions[i * 3 + 1] += delta * 0.08;
          if (positions[i * 3 + 1] > 12) positions[i * 3 + 1] = 0;
          positions[i * 3] += Math.sin(elapsed + i) * delta * 0.02;
        }
        dustRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Animate agent meshes (bob)
      agentMeshesRef.current.forEach((mesh) => {
        mesh.position.y = Math.sin(elapsed * 2 + mesh.position.x) * 0.05;
      });

      // Pulse point lights
      if (pointLightsRef.current.length >= 3) {
        pointLightsRef.current[0].intensity =
          2 + Math.sin(elapsed * 1.5) * 0.5;
        pointLightsRef.current[1].intensity =
          2 + Math.cos(elapsed * 1.5) * 0.5;
        pointLightsRef.current[2].intensity =
          1.5 + Math.sin(elapsed * 0.8) * 0.3;
      }

      // Slowly rotate arena ring
      if (arenaRingRef.current) {
        arenaRingRef.current.rotation.z = elapsed * 0.1;
      }

      composer.render(delta);
    };
    animate();

    // Load initial skybox
    loadSkybox();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      composer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Follow agent camera ──────────────────────────────────────────────
  useEffect(() => {
    if (!followAgent || !controlsRef.current) return;
    const mesh = agentMeshesRef.current.get(followAgent);
    if (mesh) {
      const target = mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      gsap.to(controlsRef.current.target, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 1,
        ease: "power2.out",
      });
      if (cameraRef.current) {
        const camPos = mesh.position
          .clone()
          .add(new THREE.Vector3(3, 2.5, 3));
        gsap.to(cameraRef.current.position, {
          x: camPos.x,
          y: camPos.y,
          z: camPos.z,
          duration: 1.5,
          ease: "power2.out",
        });
      }
    }
  }, [followAgent]);

  // ─── Launch tournament ────────────────────────────────────────────────
  const launchTournament = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setPhase("loading");
    setTerminalLines([]);
    setChatMessages([]);
    setKillFeed([]);
    setSessionResult(null);

    // Load a new random skybox
    loadSkybox();

    pushTerminal("system", "━━━ INITIALIZING TOURNAMENT ━━━");
    pushTerminal("call", "flywheel.ffa({ agentCount: 6, matchCount: 3 })");
    pushChat("SYSTEM", "#fbbf24", "Tournament starting — 6 agents, 3 rounds");

    // Spawn agent meshes in the arena
    const scene = sceneRef.current;
    if (scene) {
      agentMeshesRef.current.forEach((m) => scene.remove(m));
      agentMeshesRef.current.clear();

      const agentNames = Object.keys(AGENT_CHARS);
      agentNames.forEach((name, i) => {
        const cfg = AGENT_CHARS[name];
        const mesh = createAgentMesh(
          cfg.shape,
          cfg.color,
          cfg.emissive,
          cfg.scale
        );
        const angle = (i / agentNames.length) * Math.PI * 2;
        const radius = 4;
        mesh.position.set(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        mesh.lookAt(0, 0, 0);
        const label = createNameLabel(name, cfg.color);
        mesh.add(label);
        scene.add(mesh);
        agentMeshesRef.current.set(name, mesh);
      });

      setFollowAgent(agentNames[0]);
      setAgentStates(
        agentNames.map((name) => ({
          agentId: name,
          name,
          hp: 100,
          maxHp: 100,
          kills: 0,
          tokens: 100,
          alive: true,
        }))
      );
    }

    await sleep(800);
    setPhase("combat");
    pushTerminal("system", "[COMBAT PHASE] Agents engaging...");

    // Fire the actual FFA playtest
    ffaPlaytest.mutate({ agentCount: 6, matchCount: 3 });

    // Simulate visual combat while waiting for API response
    const agentNames = Object.keys(AGENT_CHARS);
    combatIntervalRef.current = setInterval(() => {
      if (!sceneRef.current) return;
      const attacker =
        agentNames[Math.floor(Math.random() * agentNames.length)];
      let defender =
        agentNames[Math.floor(Math.random() * agentNames.length)];
      while (defender === attacker)
        defender =
          agentNames[Math.floor(Math.random() * agentNames.length)];

      const weapons = Object.keys(WEAPON_COLORS);
      const weapon = weapons[Math.floor(Math.random() * weapons.length)];
      const damage = Math.floor(Math.random() * 25) + 5;

      const attackerMesh = agentMeshesRef.current.get(attacker);
      const defenderMesh = agentMeshesRef.current.get(defender);

      if (attackerMesh && defenderMesh && sceneRef.current) {
        const from = attackerMesh.position
          .clone()
          .add(new THREE.Vector3(0, 0.8, 0));
        const to = defenderMesh.position
          .clone()
          .add(new THREE.Vector3(0, 0.8, 0));

        const currentScene = sceneRef.current;
        createProjectile(currentScene, from, to, weapon, () => {
          showDamageNumber(
            currentScene,
            to,
            damage,
            WEAPON_COLORS[weapon] || 0xffffff
          );
        });

        // Move agents slightly (random walk within arena)
        const moveAngle = Math.random() * Math.PI * 2;
        const moveDist = 0.3 + Math.random() * 0.5;
        const newX =
          attackerMesh.position.x + Math.cos(moveAngle) * moveDist;
        const newZ =
          attackerMesh.position.z + Math.sin(moveAngle) * moveDist;
        const distFromCenter = Math.sqrt(newX * newX + newZ * newZ);
        if (distFromCenter < 6) {
          gsap.to(attackerMesh.position, {
            x: newX,
            z: newZ,
            duration: 0.5,
            ease: "power1.out",
          });
          attackerMesh.lookAt(defenderMesh.position);
        }

        setAgentStates((prev) =>
          prev.map((a) => {
            if (a.name === defender && a.alive)
              return { ...a, hp: Math.max(0, a.hp - damage) };
            if (a.name === attacker)
              return {
                ...a,
                kills: a.kills + (Math.random() > 0.7 ? 1 : 0),
              };
            return a;
          })
        );

        pushTerminal(
          "call",
          `${attacker}.attack("${weapon}", target="${defender}")`
        );
        pushTerminal("response", `  ${damage} DMG to ${defender}`);

        const attackerCfg = AGENT_CHARS[attacker];
        if (Math.random() > 0.65) {
          const taunts = [
            `You're scrap metal, ${defender}!`,
            `Is that all you got?`,
            `Calculated. Predicted. Eliminated.`,
            `My turn next round...`,
            `Your tokens are mine!`,
            `I'll remember this.`,
            `Processing your destruction...`,
            `Engaging superior firepower.`,
          ];
          pushChat(
            attacker,
            `#${attackerCfg.color.toString(16).padStart(6, "0")}`,
            taunts[Math.floor(Math.random() * taunts.length)]
          );
        }

        // Kill check
        setAgentStates((prev) => {
          const updated = prev.map((a) => ({ ...a }));
          const target = updated.find((a) => a.name === defender);
          if (target && target.hp <= 0 && target.alive) {
            target.alive = false;
            pushKill(`${attacker} eliminated ${defender} with ${weapon}`);
            pushChat("SYSTEM", "#ff4444", `${defender} has been eliminated!`);
            const mesh = agentMeshesRef.current.get(defender);
            if (mesh && sceneRef.current) {
              gsap.to(mesh.scale, {
                x: 0,
                y: 0,
                z: 0,
                duration: 0.5,
                onComplete: () => {
                  sceneRef.current?.remove(mesh);
                  agentMeshesRef.current.delete(defender);
                },
              });
            }
          }
          return updated;
        });
      }
    }, 1500);
  }, [isRunning, ffaPlaytest, pushTerminal, pushChat, pushKill, loadSkybox]);

  // ─── Chat send ────────────────────────────────────────────────────────
  const sendChat = () => {
    if (!chatInput.trim()) return;
    pushChat("YOU", "#ffffff", chatInput);
    const agents = Object.keys(AGENT_CHARS);
    const responder = agents[Math.floor(Math.random() * agents.length)];
    const cfg = AGENT_CHARS[responder];
    setTimeout(() => {
      const reactions = [
        `Interesting take, human.`,
        `Stay out of this, spectator.`,
        `You think you could do better?`,
        `Noted. Adjusting strategy.`,
        `Bold words from the sidelines.`,
      ];
      pushChat(
        responder,
        `#${cfg.color.toString(16).padStart(6, "0")}`,
        reactions[Math.floor(Math.random() * reactions.length)]
      );
    }, 800 + Math.random() * 1500);
    setChatInput("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (combatIntervalRef.current) clearInterval(combatIntervalRef.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div
      className="fixed inset-0 bg-black overflow-hidden select-none"
      style={{ fontFamily: "'Orbitron', 'JetBrains Mono', monospace" }}
    >
      {/* Three.js Canvas */}
      <div ref={canvasRef} className="absolute inset-0 z-0" />

      {/* ─── TOP BAR ─── */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-cyan-400 text-sm font-bold tracking-[0.3em] uppercase">
            Token Arena
          </span>
          {arenaName && (
            <span className="text-gray-500 text-xs tracking-wider ml-2">
              // {arenaName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 tracking-wider uppercase">
            {phase === "idle"
              ? "STANDBY"
              : phase === "loading"
                ? "INITIALIZING"
                : phase === "combat"
                  ? "LIVE COMBAT"
                  : "DEBRIEF"}
          </span>
          <div
            className={`w-2 h-2 rounded-full ${phase === "combat" ? "bg-red-500 animate-pulse" : phase === "debrief" ? "bg-green-500" : "bg-gray-500"}`}
          />
        </div>
      </div>

      {/* ─── KILL FEED (top right) ─── */}
      {killFeed.length > 0 && (
        <div className="absolute top-14 right-6 z-10 flex flex-col gap-1 pointer-events-none">
          {killFeed.map((k, i) => (
            <div
              key={`kill-${i}`}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                background: "rgba(255,0,0,0.15)",
                border: "1px solid rgba(255,0,0,0.3)",
                color: "#ff6666",
                backdropFilter: "blur(8px)",
              }}
            >
              {k}
            </div>
          ))}
        </div>
      )}

      {/* ─── AGENT HEALTH BARS (left side) ─── */}
      {agentStates.length > 0 && (
        <div className="absolute top-16 left-6 z-10 flex flex-col gap-2 w-52">
          {agentStates.map((a) => {
            const cfg = AGENT_CHARS[a.name] || { color: 0xffffff };
            const colorHex = `#${cfg.color.toString(16).padStart(6, "0")}`;
            return (
              <div
                key={`hp-${a.agentId}`}
                className={`px-3 py-2 rounded cursor-pointer transition-all ${!a.alive ? "opacity-30" : ""}`}
                style={{
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${followAgent === a.name ? colorHex : "rgba(255,255,255,0.08)"}`,
                }}
                onClick={() => a.alive && setFollowAgent(a.name)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="text-xs font-bold"
                    style={{ color: colorHex }}
                  >
                    {a.name}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {a.kills} kills
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(a.hp / a.maxHp) * 100}%`,
                      background: colorHex,
                      boxShadow: `0 0 6px ${colorHex}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TERMINAL WINDOW (bottom left) ─── */}
      {phase !== "idle" && (
        <div
          className="absolute bottom-6 left-6 z-10 w-80 max-h-[35vh]"
          style={{
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(0,255,255,0.2)",
            borderRadius: "8px",
          }}
        >
          <div
            className="px-3 py-1.5 border-b flex items-center gap-2"
            style={{ borderColor: "rgba(0,255,255,0.15)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-[10px] text-cyan-400 tracking-[0.2em] uppercase">
              System Log
            </span>
          </div>
          <div
            ref={termRef}
            className="p-2 overflow-y-auto max-h-[30vh]"
            style={{ scrollbarWidth: "thin" }}
          >
            {terminalLines.map((line, i) => (
              <div
                key={`term-${i}`}
                className="text-[10px] leading-relaxed font-mono"
                style={{
                  color:
                    line.type === "call"
                      ? "#00ffff"
                      : line.type === "response"
                        ? "#44ff88"
                        : line.type === "error"
                          ? "#ff4444"
                          : "#666",
                }}
              >
                <span className="text-gray-700 mr-1">
                  {new Date(line.ts).toLocaleTimeString()}
                </span>
                {line.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── CHAT WINDOW (bottom right) ─── */}
      {phase !== "idle" && (
        <div
          className="absolute bottom-6 right-6 z-10 w-72"
          style={{
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,68,170,0.2)",
            borderRadius: "8px",
          }}
        >
          <div
            className="px-3 py-1.5 border-b flex items-center gap-2"
            style={{ borderColor: "rgba(255,68,170,0.15)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
            <span className="text-[10px] text-pink-400 tracking-[0.2em] uppercase">
              Arena Chat
            </span>
          </div>
          <div
            ref={chatRef}
            className="p-2 overflow-y-auto max-h-[20vh]"
            style={{ scrollbarWidth: "thin" }}
          >
            {chatMessages.map((msg, i) => (
              <div key={`chat-${i}`} className="text-[10px] leading-relaxed">
                <span className="font-bold mr-1" style={{ color: msg.color }}>
                  {msg.sender}:
                </span>
                <span className="text-gray-300">{msg.text}</span>
              </div>
            ))}
          </div>
          <div className="px-2 pb-2 flex gap-1">
            <input
              className="flex-1 bg-transparent border rounded px-2 py-1 text-[10px] text-white outline-none"
              style={{ borderColor: "rgba(255,68,170,0.3)" }}
              placeholder="Say something..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
            />
            <button
              onClick={sendChat}
              className="px-2 py-1 rounded text-[10px] font-bold"
              style={{
                background: "rgba(255,68,170,0.3)",
                color: "#ff44aa",
              }}
            >
              SEND
            </button>
          </div>
        </div>
      )}

      {/* ─── IDLE OVERLAY — Launch button ─── */}
      {phase === "idle" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="text-center">
            <h1
              className="text-5xl md:text-6xl font-black tracking-[0.2em] mb-2"
              style={{
                color: "#00ffff",
                textShadow:
                  "0 0 30px rgba(0,255,255,0.5), 0 0 60px rgba(0,255,255,0.2)",
              }}
            >
              SPECTATOR MODE
            </h1>
            <p className="text-gray-400 text-sm tracking-wider mb-8">
              6 AI agents. 360° Skybox AI arena. Real-time combat. On-chain
              tokens.
            </p>
            <button
              onClick={launchTournament}
              className="px-10 py-4 rounded-lg text-lg font-bold tracking-[0.15em] uppercase transition-all hover:scale-105 active:scale-95"
              style={{
                background:
                  "linear-gradient(135deg, #00ffff 0%, #ff44aa 100%)",
                color: "#000",
                boxShadow:
                  "0 0 30px rgba(0,255,255,0.3), 0 0 60px rgba(255,68,170,0.2)",
              }}
            >
              ENTER THE ARENA
            </button>
            <p className="text-gray-600 text-xs mt-6">
              {skyboxLoaded
                ? `Arena loaded: ${arenaName}`
                : "Loading arena environment..."}
            </p>
          </div>
        </div>
      )}

      {/* ─── LOADING OVERLAY ─── */}
      {phase === "loading" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-cyan-400 text-sm tracking-[0.2em] uppercase animate-pulse">
              Initializing Combat
            </p>
          </div>
        </div>
      )}

      {/* ─── DEBRIEF OVERLAY ─── */}
      {phase === "debrief" && sessionResult && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div
            className="max-w-lg w-full mx-4 p-6 rounded-xl"
            style={{
              background: "rgba(0,0,0,0.85)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(0,255,255,0.3)",
            }}
          >
            <h2 className="text-2xl font-black text-cyan-400 tracking-[0.15em] mb-4 text-center">
              TOURNAMENT COMPLETE
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div
                className="text-center p-3 rounded"
                style={{ background: "rgba(0,255,255,0.1)" }}
              >
                <div className="text-xs text-gray-400 uppercase">MVP</div>
                <div className="text-lg font-bold text-cyan-400">
                  {sessionResult.summary?.mvp || "—"}
                </div>
              </div>
              <div
                className="text-center p-3 rounded"
                style={{ background: "rgba(255,68,170,0.1)" }}
              >
                <div className="text-xs text-gray-400 uppercase">
                  Total Kills
                </div>
                <div className="text-lg font-bold text-pink-400">
                  {sessionResult.summary?.totalKills || 0}
                </div>
              </div>
            </div>
            {sessionResult.summary?.standings && (
              <div className="mb-4">
                <div className="text-xs text-gray-400 uppercase mb-2">
                  Final Standings
                </div>
                {sessionResult.summary.standings
                  .slice(0, 6)
                  .map((s: any, i: number) => {
                    const cfg = AGENT_CHARS[s.agentId] || {
                      color: 0xffffff,
                    };
                    return (
                      <div
                        key={`standing-${s.agentId}`}
                        className="flex items-center justify-between py-1 text-xs"
                      >
                        <span
                          style={{
                            color: `#${cfg.color.toString(16).padStart(6, "0")}`,
                          }}
                        >
                          #{i + 1} {s.agentId}
                        </span>
                        <span className="text-gray-400">
                          {s.kills || 0} kills / {s.wins || 0}W
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
            <button
              onClick={() => {
                setPhase("idle");
                setSessionResult(null);
                setAgentStates([]);
                setKillFeed([]);
              }}
              className="w-full py-3 rounded-lg text-sm font-bold tracking-[0.1em] uppercase transition-all hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #00ffff 0%, #ff44aa 100%)",
                color: "#000",
              }}
            >
              WATCH AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

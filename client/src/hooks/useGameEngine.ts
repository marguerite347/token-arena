import { useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useGame, type Agent, type Projectile, WEAPONS, type WeaponType } from "@/contexts/GameContext";
import { updateAgentAI, notifyAgentDamaged, resetAgentStates } from "@/lib/aiCombat";
import { getActiveRecorder } from "@/lib/replayEngine";
import { ParticleSystem } from "@/lib/particleSystem";
import { createPostProcessing, triggerGlitch, resizePostProcessing, type PostProcessingPipeline } from "@/lib/postProcessing";
import { createArenaVisuals, updateArenaVisuals, triggerArenaPulse, flashCombatLights, disposeArenaVisuals, type ArenaElements } from "@/lib/arenaVisuals";
import { createHolographicMaterial, updateHolographicMaterial } from "@/lib/holographicMaterial";
import { SpectatorCamera } from "@/lib/spectatorCamera";

interface GameEngineOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// ─── Projectile visual ──────────────────────────────────────────────────────
interface ProjVis {
  mesh: THREE.Mesh;
  trail?: THREE.Line;
}

export function useGameEngine({ canvasRef }: GameEngineOptions) {
  const { state, dispatch } = useGame();

  // Refs to avoid stale closures in the game loop
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const skyboxMeshRef = useRef<THREE.Mesh | null>(null);
  const agentMeshes = useRef<Map<string, THREE.Group>>(new Map());
  const projMeshes = useRef<Map<string, ProjVis>>(new Map());
  const animFrame = useRef(0);
  const lastTime = useRef(0);
  const mouse = useRef({ isDown: false });
  const keys = useRef(new Set<string>());
  const playerRot = useRef({ yaw: 0, pitch: 0 });
  const lastFire = useRef(0);
  const spectatorAngle = useRef(0);
  const initDone = useRef(false);

  // ─── NEW: Enhanced visual system refs ─────────────────────────────────────
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const postProcessingRef = useRef<PostProcessingPipeline | null>(null);
  const arenaVisualsRef = useRef<ArenaElements | null>(null);
  const spectatorCamRef = useRef<SpectatorCamera | null>(null);
  const holoMaterialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const totalTimeRef = useRef(0);
  const ambientParticleTimer = useRef(0);
  const prevAgentPositions = useRef<Map<string, { x: number; z: number }>>(new Map());
  const prevAgentAlive = useRef<Map<string, boolean>>(new Map());

  // ─── Scene init ───────────────────────────────────────────────────────────
  const initScene = useCallback(() => {
    if (!canvasRef.current || initDone.current) return;
    initDone.current = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // Ambient light
    scene.add(new THREE.AmbientLight(0x1a1a3a, 0.6));

    // ─── NEW: Enhanced arena visuals (replaces old grid/ring/pillars) ────
    const arena = createArenaVisuals(scene);
    arenaVisualsRef.current = arena;

    // ─── NEW: Particle system ───────────────────────────────────────────
    const particles = new ParticleSystem(scene, 3000);
    particleSystemRef.current = particles;

    // ─── NEW: Post-processing pipeline ──────────────────────────────────
    const pp = createPostProcessing(renderer, scene, camera);
    postProcessingRef.current = pp;

    // ─── NEW: Spectator camera ──────────────────────────────────────────
    const specCam = new SpectatorCamera(camera);
    spectatorCamRef.current = specCam;

  }, [canvasRef]);

  // ─── Skybox loader ────────────────────────────────────────────────────────
  const loadSkybox = useCallback((imageUrl: string) => {
    if (!sceneRef.current) return;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(imageUrl, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      if (skyboxMeshRef.current) sceneRef.current!.remove(skyboxMeshRef.current);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(100, 64, 32),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })
      );
      sceneRef.current!.add(mesh);
      skyboxMeshRef.current = mesh;
      sceneRef.current!.environment = tex;
      sceneRef.current!.fog = null; // disable fog when skybox is loaded
    });
  }, []);

  // ─── Agent mesh factory (enhanced with holographic elements) ──────────────
  const makeAgent = useCallback((a: Agent): THREE.Group => {
    const g = new THREE.Group();
    const c = new THREE.Color(a.color);

    // Body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.2, 0.4),
      new THREE.MeshPhongMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, transparent: true, opacity: 0.9 })
    );
    body.position.y = 0.8;
    g.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshPhongMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 })
    );
    head.position.y = 1.6;
    g.add(head);

    // Visor — now holographic
    const visorMat = createHolographicMaterial({
      color: "#00f0ff",
      scanlineSize: 15,
      brightness: 2.0,
      fresnelAmount: 0.3,
      opacity: 0.9,
      signalSpeed: 1.5,
    });
    holoMaterialsRef.current.push(visorMat);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.05),
      visorMat
    );
    visor.position.set(0, 1.65, 0.23);
    g.add(visor);

    // Gun
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.6),
      new THREE.MeshPhongMaterial({ color: 0x333333, emissive: c, emissiveIntensity: 0.2 })
    );
    gun.position.set(0.4, 1.0, 0.3);
    g.add(gun);

    // Health bar bg — holographic
    const hbBgMat = createHolographicMaterial({
      color: "#1a1a2e",
      scanlineSize: 20,
      brightness: 0.5,
      opacity: 0.6,
      enableAdditive: false,
    });
    holoMaterialsRef.current.push(hbBgMat);
    const hbBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.08),
      hbBgMat
    );
    hbBg.position.y = 2.1;
    hbBg.name = "hb-bg";
    g.add(hbBg);

    // Health bar fill
    const hb = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x39ff14 })
    );
    hb.position.y = 2.1;
    hb.position.z = 0.001;
    hb.name = "hb";
    g.add(hb);

    // Name label — holographic
    const nameTagMat = createHolographicMaterial({
      color: "#" + c.getHexString(),
      scanlineSize: 10,
      brightness: 1.0,
      fresnelAmount: 0.2,
      opacity: 0.7,
    });
    holoMaterialsRef.current.push(nameTagMat);
    const nameTag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.15),
      nameTagMat
    );
    nameTag.position.y = 2.3;
    nameTag.name = "nametag";
    g.add(nameTag);

    // Glow light
    const glow = new THREE.PointLight(c, 0.5, 5);
    glow.position.y = 1;
    g.add(glow);

    g.position.set(a.x, a.y, a.z);
    g.rotation.y = a.rotation;
    return g;
  }, []);

  // ─── Projectile mesh factory (enhanced with emissive glow) ────────────────
  const makeProj = useCallback((p: Projectile): THREE.Mesh => {
    const c = new THREE.Color(p.color);
    let geo: THREE.BufferGeometry;
    switch (p.type) {
      case "railgun": geo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6); break;
      case "scatter": geo = new THREE.OctahedronGeometry(0.1); break;
      case "missile": geo = new THREE.ConeGeometry(0.12, 0.5, 6); break;
      case "nova": geo = new THREE.IcosahedronGeometry(0.18); break;
      case "beam": geo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4); break;
      default: geo = new THREE.SphereGeometry(0.08, 8, 8);
    }
    // Enhanced: use emissive material for bloom pickup
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9,
    }));
  }, []);

  // ─── Main game loop ───────────────────────────────────────────────────────
  const gameLoop = useCallback((time: number) => {
    const s = stateRef.current;
    const d = dispatchRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;

    if (!renderer || !scene || !camera) {
      animFrame.current = requestAnimationFrame(gameLoop);
      return;
    }

    const dt = Math.min((time - lastTime.current) / 1000, 0.05);
    lastTime.current = time;
    totalTimeRef.current += dt;

    // ─── COMBAT LOGIC ─────────────────────────────────────────────────
    if (s.phase === "combat" && !s.isPaused) {
      d({ type: "TICK", delta: dt });

      // Player movement
      if (s.mode === "pvai" && s.player.isAlive) {
        const spd = 5 * dt;
        const yaw = playerRot.current.yaw;
        let px = s.player.x, pz = s.player.z;

        if (keys.current.has("w") || keys.current.has("arrowup")) { px -= Math.sin(yaw) * spd; pz -= Math.cos(yaw) * spd; }
        if (keys.current.has("s") || keys.current.has("arrowdown")) { px += Math.sin(yaw) * spd; pz += Math.cos(yaw) * spd; }
        if (keys.current.has("a") || keys.current.has("arrowleft")) { px -= Math.cos(yaw) * spd; pz += Math.sin(yaw) * spd; }
        if (keys.current.has("d") || keys.current.has("arrowright")) { px += Math.cos(yaw) * spd; pz -= Math.sin(yaw) * spd; }

        const pDist = Math.sqrt(px * px + pz * pz);
        if (pDist > 18) { px *= 18 / pDist; pz *= 18 / pDist; }

        d({ type: "UPDATE_PLAYER", updates: { x: px, z: pz, rotation: yaw } });

        // FPS camera
        camera.position.set(px, 1.6, pz);
        camera.rotation.order = "YXZ";
        camera.rotation.y = -yaw;
        camera.rotation.x = playerRot.current.pitch;

        // Player firing
        if (mouse.current.isDown) {
          const now = Date.now();
          if (now - lastFire.current >= s.player.weapon.fireRate && s.player.tokens >= s.player.weapon.tokenCost) {
            lastFire.current = now;
            d({ type: "SPEND_TOKENS", amount: s.player.weapon.tokenCost });

            const dir = new THREE.Vector3(0, 0, -1);
            dir.applyEuler(new THREE.Euler(playerRot.current.pitch, -yaw, 0, "YXZ"));
            const spd2 = s.player.weapon.projectileSpeed;

            const createProj = (dx: number, dy: number, dz: number, id: string) => ({
              id,
              ownerId: s.player.id,
              x: px, y: 1.2, z: pz,
              vx: dx * spd2, vy: dy * spd2, vz: dz * spd2,
              damage: s.player.weapon.damage,
              tokenValue: s.player.weapon.tokenCost,
              color: s.player.weapon.color,
              type: s.player.weapon.type,
              createdAt: now,
            });

            if (s.player.weapon.type === "scatter") {
              for (let i = 0; i < 5; i++) {
                d({ type: "ADD_PROJECTILE", projectile: createProj(
                  dir.x + (Math.random() - 0.5) * 0.3,
                  dir.y + (Math.random() - 0.5) * 0.2,
                  dir.z + (Math.random() - 0.5) * 0.3,
                  `p-${now}-${i}`
                ) as Projectile });
              }
            } else if (s.player.weapon.type === "nova") {
              for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                d({ type: "ADD_PROJECTILE", projectile: createProj(Math.sin(a), 0, Math.cos(a), `p-${now}-${i}`) as Projectile });
              }
            } else {
              d({ type: "ADD_PROJECTILE", projectile: createProj(dir.x, dir.y, dir.z, `p-${now}`) as Projectile });
            }
          }
        }
      }

      // Spectator camera (AI vs AI or dead player)
      if (s.mode === "aivai" || (s.mode === "pvai" && !s.player.isAlive)) {
        // ─── NEW: Use enhanced spectator camera ─────────────────────
        if (spectatorCamRef.current) {
          const agentTargets = s.agents.filter(a => a.isAlive).map(a => ({
            x: a.x, y: a.y, z: a.z, id: a.id, name: a.name,
          }));
          spectatorCamRef.current.update(dt, agentTargets, keys.current);
        } else {
          // Fallback to old orbit
          spectatorAngle.current += dt * 0.3;
          const alive = s.agents.filter((a) => a.isAlive);
          let cx = 0, cz = 0;
          if (alive.length > 0) {
            cx = alive.reduce((sum, a) => sum + a.x, 0) / alive.length;
            cz = alive.reduce((sum, a) => sum + a.z, 0) / alive.length;
          }
          const radius = 12;
          camera.position.set(
            cx + Math.cos(spectatorAngle.current) * radius,
            8,
            cz + Math.sin(spectatorAngle.current) * radius
          );
          camera.lookAt(cx, 1, cz);
        }
      }

      // ─── SMART AI COMBAT ──────────────────────────────────────────────
      for (let i = 0; i < s.agents.length; i++) {
        const agent = s.agents[i];
        if (!agent.isAlive) continue;

        const action = updateAgentAI(
          agent, i, s.agents, s.player, s.projectiles,
          s.mode as "pvai" | "aivai", dt
        );
        if (!action) continue;

        // Apply movement
        d({ type: "UPDATE_AGENT", id: agent.id, updates: {
          x: action.movement.x,
          z: action.movement.z,
          rotation: action.movement.rotation,
        }});

        // Apply weapon switch
        if (action.weaponSwitch && WEAPONS[action.weaponSwitch]) {
          d({ type: "UPDATE_AGENT", id: agent.id, updates: {
            weapon: WEAPONS[action.weaponSwitch],
          }});
        }

        // Apply firing
        if (action.fire && agent.tokens >= agent.weapon.tokenCost) {
          const target = action.fire.target;
          const tdx = target.x - agent.x, tdz = target.z - agent.z;
          const dist = Math.sqrt(tdx * tdx + tdz * tdz);
          if (dist > 0.5) {
            const nnx = tdx / dist, nnz = tdz / dist;
            d({ type: "UPDATE_AGENT", id: agent.id, updates: { tokens: agent.tokens - agent.weapon.tokenCost } });
            const now = Date.now();
            const w = agent.weapon;
            const aim = action.fire.aimOffset;

            if (w.type === "scatter") {
              for (let j = 0; j < 5; j++) {
                d({ type: "ADD_PROJECTILE", projectile: {
                  id: `p-${now}-${agent.id}-${j}-${Math.random().toString(36).slice(2, 5)}`,
                  ownerId: agent.id,
                  x: agent.x, y: 1.2, z: agent.z,
                  vx: (nnx + aim.x + (Math.random() - 0.5) * 0.3) * w.projectileSpeed,
                  vy: (aim.y + (Math.random() - 0.5) * 0.2) * w.projectileSpeed * 0.3,
                  vz: (nnz + aim.z + (Math.random() - 0.5) * 0.3) * w.projectileSpeed,
                  damage: w.damage, tokenValue: w.tokenCost,
                  color: w.color, type: w.type, createdAt: now,
                }});
              }
            } else if (w.type === "nova") {
              for (let j = 0; j < 12; j++) {
                const a = (j / 12) * Math.PI * 2;
                d({ type: "ADD_PROJECTILE", projectile: {
                  id: `p-${now}-${agent.id}-${j}-${Math.random().toString(36).slice(2, 5)}`,
                  ownerId: agent.id,
                  x: agent.x, y: 1.2, z: agent.z,
                  vx: Math.sin(a) * w.projectileSpeed,
                  vy: 0,
                  vz: Math.cos(a) * w.projectileSpeed,
                  damage: w.damage, tokenValue: w.tokenCost,
                  color: w.color, type: w.type, createdAt: now,
                }});
              }
            } else {
              d({ type: "ADD_PROJECTILE", projectile: {
                id: `p-${now}-${agent.id}-${Math.random().toString(36).slice(2, 6)}`,
                ownerId: agent.id,
                x: agent.x, y: 1.2, z: agent.z,
                vx: (nnx + aim.x) * w.projectileSpeed,
                vy: aim.y * w.projectileSpeed * 0.3,
                vz: (nnz + aim.z) * w.projectileSpeed,
                damage: w.damage, tokenValue: w.tokenCost,
                color: w.color, type: w.type, createdAt: now,
              }});
            }
          }
        }
      }

      // Update projectiles + collisions
      const updatedProjs: Projectile[] = [];
      const now = Date.now();

      for (const p of s.projectiles) {
        if (now - p.createdAt > 3000) continue;
        const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
        if (Math.abs(nx) > 25 || Math.abs(nz) > 25 || ny < -1 || ny > 10) continue;

        let hit = false;

        // Hit agents
        for (const agent of s.agents) {
          if (!agent.isAlive || agent.id === p.ownerId) continue;
          const ddx = nx - agent.x, ddz = nz - agent.z, ddy = ny - 1.0;
          if (Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) < 0.8) {
            hit = true;
            const dmg = Math.max(1, p.damage - agent.armorValue * 0.01 * p.damage);
            const hp = Math.max(0, agent.health - dmg);
            d({ type: "UPDATE_AGENT", id: agent.id, updates: { health: hp } });
            notifyAgentDamaged(agent.id, p.ownerId);

            // ─── NEW: Hit spark particles ───────────────────────────
            if (particleSystemRef.current) {
              particleSystemRef.current.emitHitSparks(
                new THREE.Vector3(nx, ny, nz),
                p.color
              );
            }
            // ─── NEW: Arena pulse on hit ────────────────────────────
            if (arenaVisualsRef.current) {
              triggerArenaPulse(arenaVisualsRef.current, new THREE.Vector3(nx, 0, nz), totalTimeRef.current);
            }

            if (hp <= 0) {
              d({ type: "AGENT_KILLED", killerId: p.ownerId, victimId: agent.id });
              const killerName = p.ownerId === s.player.id ? "PLAYER" : s.agents.find((a) => a.id === p.ownerId)?.name || "?";
              d({ type: "ADD_LOG", log: { id: `k-${now}-${Math.random()}`, timestamp: now, message: `${killerName} eliminated ${agent.name}`, type: "kill" } });
              const replayRec = getActiveRecorder();
              if (replayRec) replayRec.recordKill(p.ownerId, killerName, agent.id, agent.name, s.matchTime);
              if (p.ownerId === s.player.id) d({ type: "EARN_TOKENS", amount: 25 });

              // ─── NEW: Death explosion particles ───────────────────
              if (particleSystemRef.current) {
                particleSystemRef.current.emitDeathExplosion(
                  new THREE.Vector3(agent.x, 1.2, agent.z),
                  agent.color
                );
              }
              // ─── NEW: Flash combat lights on kill ─────────────────
              if (arenaVisualsRef.current) {
                flashCombatLights(arenaVisualsRef.current, new THREE.Color(agent.color).getHex(), 5);
              }
              // ─── NEW: Glitch effect on kill ───────────────────────
              if (postProcessingRef.current) {
                triggerGlitch(postProcessingRef.current, 300);
              }
              // ─── NEW: Notify spectator camera ─────────────────────
              if (spectatorCamRef.current) {
                spectatorCamRef.current.notifyKill(p.ownerId);
              }
            }
            break;
          }
        }

        // Hit player
        if (!hit && p.ownerId !== s.player.id && s.player.isAlive && s.mode === "pvai") {
          const ddx = nx - s.player.x, ddz = nz - s.player.z, ddy = ny - 1.0;
          if (Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz) < 0.8) {
            hit = true;
            const dmg = Math.max(1, p.damage - s.player.armorValue * 0.01 * p.damage);
            const hp = Math.max(0, s.player.health - dmg);
            d({ type: "UPDATE_PLAYER", updates: { health: hp } });
            d({ type: "EARN_TOKENS", amount: p.tokenValue });

            // ─── NEW: Hit particles + glitch on player damage ───────
            if (particleSystemRef.current) {
              particleSystemRef.current.emitHitSparks(
                new THREE.Vector3(nx, ny, nz),
                p.color
              );
            }
            if (postProcessingRef.current) {
              triggerGlitch(postProcessingRef.current, 150);
            }

            if (hp <= 0) {
              d({ type: "AGENT_KILLED", killerId: p.ownerId, victimId: s.player.id });
              const pKillerName = s.agents.find((a) => a.id === p.ownerId)?.name || "?";
              d({ type: "ADD_LOG", log: { id: `d-${now}`, timestamp: now, message: `PLAYER eliminated by ${pKillerName}`, type: "kill" } });
              const replayRec2 = getActiveRecorder();
              if (replayRec2) replayRec2.recordKill(p.ownerId, pKillerName, s.player.id, "PLAYER", s.matchTime);

              // ─── NEW: Player death explosion ──────────────────────
              if (particleSystemRef.current) {
                particleSystemRef.current.emitDeathExplosion(
                  new THREE.Vector3(s.player.x, 1.2, s.player.z),
                  "#00f0ff"
                );
              }
              if (postProcessingRef.current) {
                triggerGlitch(postProcessingRef.current, 500);
              }
            }
          }
        }

        if (!hit) updatedProjs.push({ ...p, x: nx, y: ny, z: nz });
      }

      d({ type: "UPDATE_PROJECTILES", projectiles: updatedProjs });

      // ─── BANKRUPTCY CHECK ─────────────────────────────────────────────
      for (const agent of s.agents) {
        if (!agent.isAlive) continue;
        if (agent.tokens <= 0 && !agent.isBankrupt) {
          d({ type: "AGENT_BANKRUPT", agentId: agent.id });
          d({
            type: "ADD_LOG",
            log: {
              id: `bankrupt-${Date.now()}-${agent.id}`,
              timestamp: Date.now(),
              message: `⚠ ${agent.name} BANKRUPT — zero tokens, eliminated from arena`,
              type: "system",
            },
          });
          const replayRecB = getActiveRecorder();
          if (replayRecB) replayRecB.recordKill("ECONOMY", "BANKRUPTCY", agent.id, agent.name, s.matchTime);

          // ─── NEW: Bankruptcy explosion (red) ──────────────────────
          if (particleSystemRef.current) {
            particleSystemRef.current.emitDeathExplosion(
              new THREE.Vector3(agent.x, 1.2, agent.z),
              0xff3333
            );
          }
        }
      }

      // ─── MEMORY MAINTENANCE COST (every 10 seconds of match time) ─────
      const memoryCycleInterval = 10;
      const prevCycle = Math.floor((s.matchTime - dt) / memoryCycleInterval);
      const currCycle = Math.floor(s.matchTime / memoryCycleInterval);
      if (currCycle > prevCycle) {
        for (const agent of s.agents) {
          if (!agent.isAlive || agent.memorySize <= 0) continue;
          const maintenanceCost = Math.max(1, Math.ceil(agent.memorySize / 100));
          if (agent.computeTokens >= maintenanceCost) {
            d({ type: "COMPUTE_SPEND", agentId: agent.id, amount: maintenanceCost, reason: "memory_maintenance" });
          }
        }
      }

      // Win/lose
      const alive = s.agents.filter((a) => a.isAlive);
      if (s.mode === "pvai") {
        if (!s.player.isAlive) d({ type: "SET_PHASE", phase: "defeat" });
        else if (alive.length === 0) d({ type: "SET_PHASE", phase: "victory" });
      } else if (s.mode === "aivai") {
        if (alive.length <= 1) d({ type: "SET_PHASE", phase: "victory" });
      }
      if (s.matchTime >= s.matchDuration) {
        if (s.mode === "aivai") {
          d({ type: "SET_PHASE", phase: "victory" });
        } else {
          d({ type: "SET_PHASE", phase: s.player.isAlive ? "victory" : "defeat" });
        }
      }
    }

    // ─── RENDER ─────────────────────────────────────────────────────────
    // Sync agent meshes
    for (const agent of s.agents) {
      let g = agentMeshes.current.get(agent.id);
      if (!g && agent.isAlive) {
        g = makeAgent(agent);
        scene.add(g);
        agentMeshes.current.set(agent.id, g);
      }
      if (g) {
        if (!agent.isAlive) {
          scene.remove(g);
          agentMeshes.current.delete(agent.id);
        } else {
          g.position.set(agent.x, agent.y, agent.z);
          g.rotation.y = agent.rotation;
          const hb = g.getObjectByName("hb") as THREE.Mesh | undefined;
          if (hb) {
            const pct = agent.health / agent.maxHealth;
            hb.scale.x = Math.max(0.01, pct);
            hb.position.x = -(1 - pct) * 0.39;
            (hb.material as THREE.MeshBasicMaterial).color.setHex(pct > 0.5 ? 0x39ff14 : pct > 0.25 ? 0xffb800 : 0xff3333);
          }
          // Billboard
          const hbBg = g.getObjectByName("hb-bg") as THREE.Mesh | undefined;
          if (hbBg) { hbBg.lookAt(camera.position); if (hb) hb.lookAt(camera.position); }
          const nt = g.getObjectByName("nametag") as THREE.Mesh | undefined;
          if (nt) nt.lookAt(camera.position);
        }
      }
    }

    // Sync projectile meshes + emit trails
    const activeIds = new Set(s.projectiles.map((p) => p.id));
    projMeshes.current.forEach((pv, id) => {
      if (!activeIds.has(id)) { scene.remove(pv.mesh); if (pv.trail) scene.remove(pv.trail); projMeshes.current.delete(id); }
    });
    for (const p of s.projectiles) {
      let pv = projMeshes.current.get(p.id);
      if (!pv) {
        const m = makeProj(p);
        scene.add(m);
        pv = { mesh: m };
        projMeshes.current.set(p.id, pv);
      }
      pv.mesh.position.set(p.x, p.y, p.z);
      pv.mesh.rotation.x += dt * 5;
      pv.mesh.rotation.z += dt * 3;

      // ─── NEW: Emit projectile trail particles ─────────────────────
      if (particleSystemRef.current) {
        particleSystemRef.current.emitTrail(
          new THREE.Vector3(p.x, p.y, p.z),
          p.color,
          p.type
        );
      }
    }

    // ─── NEW: Ambient particles ─────────────────────────────────────────
    if (particleSystemRef.current) {
      ambientParticleTimer.current += dt;
      if (ambientParticleTimer.current > 0.15) {
        ambientParticleTimer.current = 0;
        particleSystemRef.current.emitAmbient(18);
      }
      particleSystemRef.current.update(dt);
    }

    // ─── NEW: Update arena visuals ──────────────────────────────────────
    if (arenaVisualsRef.current) {
      updateArenaVisuals(arenaVisualsRef.current, dt, totalTimeRef.current);
    }

    // ─── NEW: Update holographic materials ──────────────────────────────
    holoMaterialsRef.current.forEach(mat => updateHolographicMaterial(mat, dt));

    // Record replay frame
    if (s.phase === "combat") {
      const recorder = getActiveRecorder();
      if (recorder) {
        recorder.recordFrame(s.agents, s.projectiles, s.player, s.matchTime);
      }
    }

    // ─── NEW: Render via post-processing composer instead of raw renderer
    if (postProcessingRef.current) {
      postProcessingRef.current.composer.render(dt);
    } else {
      renderer.render(scene, camera);
    }

    animFrame.current = requestAnimationFrame(gameLoop);
  }, [makeAgent, makeProj]);

  // ─── Input handlers ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (e.key === "Escape") {
        const s = stateRef.current;
        dispatchRef.current({ type: "SET_PAUSED", paused: !s.isPaused });
      }
      // Number keys to switch weapons
      const weaponKeys: Record<string, keyof typeof WEAPONS> = { "1": "plasma", "2": "railgun", "3": "scatter", "4": "missile", "5": "beam", "6": "nova" };
      if (weaponKeys[e.key]) {
        const s = stateRef.current;
        const wType = weaponKeys[e.key];
        const owned = wType === "plasma" || s.inventory.some((i) => i.weapon?.type === wType);
        if (owned) dispatchRef.current({ type: "EQUIP_WEAPON", weapon: WEAPONS[wType] });
      }
      // ─── NEW: Spectator camera controls ───────────────────────────
      if (e.key === "Tab" && spectatorCamRef.current) {
        e.preventDefault();
        const s = stateRef.current;
        const alive = s.agents.filter(a => a.isAlive);
        spectatorCamRef.current.cycleTarget(alive.map(a => ({ x: a.x, y: a.y, z: a.z, id: a.id, name: a.name })));
      }
      if (e.key === "c" && spectatorCamRef.current) {
        const modes: Array<"orbit" | "follow" | "cinematic"> = ["orbit", "follow", "cinematic"];
        const current = spectatorCamRef.current.getMode();
        const idx = modes.indexOf(current as any);
        const next = modes[(idx + 1) % modes.length];
        spectatorCamRef.current.setMode(next);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        playerRot.current.yaw += e.movementX * 0.002;
        playerRot.current.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, playerRot.current.pitch - e.movementY * 0.002));
      }
    };
    const onMouseDown = () => {
      mouse.current.isDown = true;
      const s = stateRef.current;
      if (canvasRef.current && !document.pointerLockElement && s.phase === "combat" && s.mode === "pvai") {
        canvasRef.current.requestPointerLock();
      }
    };
    const onMouseUp = () => { mouse.current.isDown = false; };
    const onResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        // ─── NEW: Resize post-processing ────────────────────────────
        if (postProcessingRef.current) {
          resizePostProcessing(postProcessingRef.current, window.innerWidth, window.innerHeight);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", onResize);
    };
  }, [canvasRef]);

  // ─── Init + loop start ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    initScene();
    lastTime.current = performance.now();
    animFrame.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animFrame.current);
      // Dispose agent meshes (geometry + material)
      agentMeshes.current.forEach((g) => {
        g.traverse((child) => {
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
          const mat = (child as THREE.Mesh).material;
          if (mat) {
            if (Array.isArray(mat)) mat.forEach(m => m.dispose());
            else (mat as THREE.Material).dispose();
          }
        });
        sceneRef.current?.remove(g);
      });
      agentMeshes.current.clear();
      // Dispose projectile meshes
      projMeshes.current.forEach((pv) => {
        if (pv.mesh.geometry) pv.mesh.geometry.dispose();
        if (pv.mesh.material) {
          if (Array.isArray(pv.mesh.material)) pv.mesh.material.forEach(m => m.dispose());
          else (pv.mesh.material as THREE.Material).dispose();
        }
        sceneRef.current?.remove(pv.mesh);
        if (pv.trail) sceneRef.current?.remove(pv.trail);
      });
      projMeshes.current.clear();
      // Dispose skybox
      if (skyboxMeshRef.current) {
        skyboxMeshRef.current.geometry?.dispose();
        const skyMat = skyboxMeshRef.current.material;
        if (skyMat && !Array.isArray(skyMat) && (skyMat as THREE.MeshBasicMaterial).map) {
          (skyMat as THREE.MeshBasicMaterial).map!.dispose();
        }
        if (skyMat) {
          if (Array.isArray(skyMat)) skyMat.forEach(m => m.dispose());
          else (skyMat as THREE.Material).dispose();
        }
      }
      // ─── NEW: Dispose enhanced visuals ────────────────────────────
      if (particleSystemRef.current && sceneRef.current) {
        particleSystemRef.current.dispose(sceneRef.current);
      }
      if (arenaVisualsRef.current && sceneRef.current) {
        disposeArenaVisuals(arenaVisualsRef.current, sceneRef.current);
      }
      holoMaterialsRef.current.forEach(mat => mat.dispose());
      holoMaterialsRef.current = [];

      rendererRef.current?.dispose();
      initDone.current = false;
    };
  }, [canvasRef, initScene, gameLoop]);

  // ─── Skybox load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.skybox.imageUrl && state.skybox.status === "ready") {
      loadSkybox(state.skybox.imageUrl);
    }
  }, [state.skybox.imageUrl, state.skybox.status, loadSkybox]);

  return { playerRotation: playerRot };
}

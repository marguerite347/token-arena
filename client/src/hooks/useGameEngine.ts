import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useGame, type Agent, type Projectile, WEAPONS, type WeaponType } from "@/contexts/GameContext";
import { updateAgentAI, notifyAgentDamaged, resetAgentStates } from "@/lib/aiCombat";
import { getActiveRecorder } from "@/lib/replayEngine";

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

  // ─── Scene init ───────────────────────────────────────────────────────────
  const initScene = useCallback(() => {
    if (!canvasRef.current || initDone.current) return;
    initDone.current = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0x1a1a3a, 0.6));
    const c1 = new THREE.PointLight(0x00f0ff, 2, 40);
    c1.position.set(8, 6, 8);
    scene.add(c1);
    const c2 = new THREE.PointLight(0xff00aa, 2, 40);
    c2.position.set(-8, 6, -8);
    scene.add(c2);
    const c3 = new THREE.PointLight(0x39ff14, 1.5, 25);
    c3.position.set(0, 4, 0);
    scene.add(c3);

    // Ground grid
    const grid = new THREE.GridHelper(40, 40, 0x00f0ff, 0x1a1a3a);
    (grid.material as THREE.Material).opacity = 0.3;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    // Arena ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(19.5, 20, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.2 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Arena pillars for visual reference
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const px = Math.cos(angle) * 18;
      const pz = Math.sin(angle) * 18;
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 4, 0.3),
        new THREE.MeshPhongMaterial({
          color: 0x00f0ff,
          emissive: 0x00f0ff,
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.6,
        })
      );
      pillar.position.set(px, 2, pz);
      scene.add(pillar);
    }
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

  // ─── Agent mesh factory ───────────────────────────────────────────────────
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

    // Visor
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
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

    // Health bar bg
    const hbBg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 })
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

    // Name label (using a small plane with color)
    const nameTag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.15),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6 })
    );
    nameTag.position.y = 2.3;
    nameTag.name = "nametag";
    g.add(nameTag);

    // Glow
    const glow = new THREE.PointLight(c, 0.5, 5);
    glow.position.y = 1;
    g.add(glow);

    g.position.set(a.x, a.y, a.z);
    g.rotation.y = a.rotation;
    return g;
  }, []);

  // ─── Projectile mesh factory ──────────────────────────────────────────────
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
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }));
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
            if (p.ownerId !== s.player.id) {
              // Agent-to-agent: tokens go to the target
            } else {
              // Player hit agent — no token earn for player (they spent to fire)
            }
            if (hp <= 0) {
              d({ type: "AGENT_KILLED", killerId: p.ownerId, victimId: agent.id });
              const killerName = p.ownerId === s.player.id ? "PLAYER" : s.agents.find((a) => a.id === p.ownerId)?.name || "?";
              d({ type: "ADD_LOG", log: { id: `k-${now}-${Math.random()}`, timestamp: now, message: `${killerName} eliminated ${agent.name}`, type: "kill" } });
              // Record kill in replay
              const replayRec = getActiveRecorder();
              if (replayRec) replayRec.recordKill(p.ownerId, killerName, agent.id, agent.name, s.matchTime);
              if (p.ownerId === s.player.id) d({ type: "EARN_TOKENS", amount: 25 });
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
            if (hp <= 0) {
              d({ type: "AGENT_KILLED", killerId: p.ownerId, victimId: s.player.id });
              const pKillerName = s.agents.find((a) => a.id === p.ownerId)?.name || "?";
              d({ type: "ADD_LOG", log: { id: `d-${now}`, timestamp: now, message: `PLAYER eliminated by ${pKillerName}`, type: "kill" } });
              // Record kill in replay
              const replayRec2 = getActiveRecorder();
              if (replayRec2) replayRec2.recordKill(p.ownerId, pKillerName, s.player.id, "PLAYER", s.matchTime);
            }
          }
        }

        if (!hit) updatedProjs.push({ ...p, x: nx, y: ny, z: nz });
      }

      d({ type: "UPDATE_PROJECTILES", projectiles: updatedProjs });

      // Win/lose
      const alive = s.agents.filter((a) => a.isAlive);
      if (s.mode === "pvai") {
        if (!s.player.isAlive) d({ type: "SET_PHASE", phase: "defeat" });
        else if (alive.length === 0) d({ type: "SET_PHASE", phase: "victory" });
      } else if (s.mode === "aivai") {
        if (alive.length <= 1) d({ type: "SET_PHASE", phase: "victory" });
      }
      if (s.matchTime >= s.matchDuration) {
        d({ type: "SET_PHASE", phase: s.player.isAlive ? "victory" : "defeat" });
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

    // Sync projectile meshes
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
      // Rotate projectile for visual effect
      pv.mesh.rotation.x += dt * 5;
      pv.mesh.rotation.z += dt * 3;
    }

    // Record replay frame
    if (s.phase === "combat") {
      const recorder = getActiveRecorder();
      if (recorder) {
        recorder.recordFrame(s.agents, s.projectiles, s.player, s.matchTime);
      }
    }

    renderer.render(scene, camera);
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
      agentMeshes.current.forEach((g) => sceneRef.current?.remove(g));
      agentMeshes.current.clear();
      projMeshes.current.forEach((pv) => { sceneRef.current?.remove(pv.mesh); if (pv.trail) sceneRef.current?.remove(pv.trail); });
      projMeshes.current.clear();
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

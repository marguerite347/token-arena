/**
 * SpectatorCamera — Cinematic camera system for Token Arena
 *
 * Modes:
 *  - Orbit: Smooth orbit around the arena center or active combat
 *  - Follow: Track a specific agent with smooth damping
 *  - FreeCam: WASD + mouse free-flight spectator controls
 *  - Cinematic: Auto-switch between agents based on action (kills, low health)
 */
import * as THREE from "three";

export type CameraMode = "orbit" | "follow" | "freecam" | "cinematic";

interface CameraTarget {
  x: number;
  y: number;
  z: number;
  id?: string;
  name?: string;
}

export class SpectatorCamera {
  private camera: THREE.PerspectiveCamera;
  private mode: CameraMode = "orbit";
  private targetId: string | null = null;

  // Orbit state
  private orbitAngle = 0;
  private orbitRadius = 14;
  private orbitHeight = 8;
  private orbitSpeed = 0.3;

  // Follow state
  private followOffset = new THREE.Vector3(0, 5, 8);
  private followLookAhead = 2.0;
  private smoothPosition = new THREE.Vector3();
  private smoothLookAt = new THREE.Vector3();
  private damping = 3.0;

  // Cinematic state
  private cinematicTimer = 0;
  private cinematicSwitchInterval = 5.0; // seconds between auto-switches
  private lastKillTime = 0;

  // FreeCam state
  private freeCamYaw = 0;
  private freeCamPitch = -0.3;
  private freeCamSpeed = 10;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.smoothPosition.copy(camera.position);
    this.smoothLookAt.set(0, 1, 0);
  }

  /** Set the camera mode */
  setMode(mode: CameraMode): void {
    this.mode = mode;
    if (mode === "orbit") {
      this.orbitAngle = Math.atan2(
        this.camera.position.z,
        this.camera.position.x
      );
    }
  }

  /** Get current mode */
  getMode(): CameraMode {
    return this.mode;
  }

  /** Set which agent to follow */
  setTarget(id: string | null): void {
    this.targetId = id;
  }

  /** Notify of a kill event (for cinematic auto-switching) */
  notifyKill(killerId: string): void {
    this.lastKillTime = performance.now();
    if (this.mode === "cinematic") {
      this.targetId = killerId;
      this.cinematicTimer = 0;
    }
  }

  /** Update camera — call each frame */
  update(
    dt: number,
    agents: CameraTarget[],
    keys: Set<string>,
    mouseDelta?: { x: number; y: number }
  ): void {
    switch (this.mode) {
      case "orbit":
        this.updateOrbit(dt, agents);
        break;
      case "follow":
        this.updateFollow(dt, agents);
        break;
      case "freecam":
        this.updateFreeCam(dt, keys, mouseDelta);
        break;
      case "cinematic":
        this.updateCinematic(dt, agents);
        break;
    }
  }

  private updateOrbit(dt: number, agents: CameraTarget[]): void {
    this.orbitAngle += this.orbitSpeed * dt;

    // Center on alive agents
    let cx = 0, cz = 0;
    const alive = agents.filter(a => a.y >= 0);
    if (alive.length > 0) {
      cx = alive.reduce((s, a) => s + a.x, 0) / alive.length;
      cz = alive.reduce((s, a) => s + a.z, 0) / alive.length;
    }

    const targetPos = new THREE.Vector3(
      cx + Math.cos(this.orbitAngle) * this.orbitRadius,
      this.orbitHeight,
      cz + Math.sin(this.orbitAngle) * this.orbitRadius
    );

    this.smoothPosition.lerp(targetPos, dt * this.damping);
    this.camera.position.copy(this.smoothPosition);

    const lookTarget = new THREE.Vector3(cx, 1.5, cz);
    this.smoothLookAt.lerp(lookTarget, dt * this.damping);
    this.camera.lookAt(this.smoothLookAt);
  }

  private updateFollow(dt: number, agents: CameraTarget[]): void {
    const target = this.targetId
      ? agents.find(a => a.id === this.targetId)
      : agents[0];

    if (!target) {
      this.updateOrbit(dt, agents);
      return;
    }

    const targetPos = new THREE.Vector3(
      target.x + this.followOffset.x,
      target.y + this.followOffset.y,
      target.z + this.followOffset.z
    );

    this.smoothPosition.lerp(targetPos, dt * this.damping);
    this.camera.position.copy(this.smoothPosition);

    const lookTarget = new THREE.Vector3(target.x, target.y + 1.5, target.z);
    this.smoothLookAt.lerp(lookTarget, dt * this.damping * 1.5);
    this.camera.lookAt(this.smoothLookAt);
  }

  private updateFreeCam(
    dt: number,
    keys: Set<string>,
    mouseDelta?: { x: number; y: number }
  ): void {
    if (mouseDelta) {
      this.freeCamYaw -= mouseDelta.x * 0.002;
      this.freeCamPitch = Math.max(
        -Math.PI / 2.5,
        Math.min(Math.PI / 2.5, this.freeCamPitch - mouseDelta.y * 0.002)
      );
    }

    const forward = new THREE.Vector3(
      -Math.sin(this.freeCamYaw) * Math.cos(this.freeCamPitch),
      Math.sin(this.freeCamPitch),
      -Math.cos(this.freeCamYaw) * Math.cos(this.freeCamPitch)
    );
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const speed = this.freeCamSpeed * dt;
    if (keys.has("w")) this.camera.position.addScaledVector(forward, speed);
    if (keys.has("s")) this.camera.position.addScaledVector(forward, -speed);
    if (keys.has("a")) this.camera.position.addScaledVector(right, -speed);
    if (keys.has("d")) this.camera.position.addScaledVector(right, speed);
    if (keys.has(" ")) this.camera.position.y += speed;
    if (keys.has("shift")) this.camera.position.y -= speed;

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.freeCamYaw;
    this.camera.rotation.x = this.freeCamPitch;
  }

  private updateCinematic(dt: number, agents: CameraTarget[]): void {
    this.cinematicTimer += dt;

    // Auto-switch target periodically or on kill
    if (this.cinematicTimer >= this.cinematicSwitchInterval || !this.targetId) {
      this.cinematicTimer = 0;
      const alive = agents.filter(a => a.y >= 0);
      if (alive.length > 0) {
        // Pick a random agent that isn't the current target
        const candidates = alive.filter(a => a.id !== this.targetId);
        const pick = candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : alive[0];
        this.targetId = pick.id ?? null;
      }
    }

    // Use follow camera for the current target
    this.updateFollow(dt, agents);
  }

  /** Cycle to the next agent target */
  cycleTarget(agents: CameraTarget[]): void {
    const alive = agents.filter(a => a.y >= 0);
    if (alive.length === 0) return;

    const currentIdx = alive.findIndex(a => a.id === this.targetId);
    const nextIdx = (currentIdx + 1) % alive.length;
    this.targetId = alive[nextIdx].id ?? null;
  }

  /** Set orbit parameters */
  setOrbitParams(radius?: number, height?: number, speed?: number): void {
    if (radius !== undefined) this.orbitRadius = radius;
    if (height !== undefined) this.orbitHeight = height;
    if (speed !== undefined) this.orbitSpeed = speed;
  }

  /** Set follow offset */
  setFollowOffset(offset: THREE.Vector3): void {
    this.followOffset.copy(offset);
  }

  /** Get current target ID */
  getTargetId(): string | null {
    return this.targetId;
  }
}

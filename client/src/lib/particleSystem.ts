/**
 * ParticleSystem — GPU-accelerated particle effects for Token Arena
 *
 * Provides:
 *  - Projectile trails (weapon-colored streaks)
 *  - Hit impact sparks
 *  - Death/elimination explosions
 *  - Ambient arena particles (floating data streams)
 *  - Spawn/teleport effects
 */
import * as THREE from "three";

// ─── Particle Pool ──────────────────────────────────────────────────────────

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  opacity: number;
  decay: number;
}

const PARTICLE_VERTEX = `
  attribute float aSize;
  attribute float aOpacity;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PARTICLE_FRAGMENT = `
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    // Soft circle
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;
    // Glow core
    float glow = exp(-dist * 6.0) * 0.8;
    vec3 color = vColor + vColor * glow;

    gl_FragColor = vec4(color, alpha);
  }
`;

export class ParticleSystem {
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private points: THREE.Points;
  private maxParticles: number;

  constructor(scene: THREE.Scene, maxParticles = 2000) {
    this.maxParticles = maxParticles;

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);
    const opacities = new Float32Array(maxParticles);
    const colors = new Float32Array(maxParticles * 3);

    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** Emit particles at a position */
  emit(config: {
    position: THREE.Vector3;
    count: number;
    color: string | number;
    speed?: number;
    size?: number;
    life?: number;
    spread?: number;
    direction?: THREE.Vector3;
    gravity?: number;
  }): void {
    const {
      position, count, color,
      speed = 3, size = 2, life = 1.0,
      spread = 1.0, direction, gravity = 0
    } = config;

    const c = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        // Recycle oldest
        this.particles.shift();
      }

      const vel = new THREE.Vector3();
      if (direction) {
        vel.copy(direction).multiplyScalar(speed);
        vel.x += (Math.random() - 0.5) * spread * speed;
        vel.y += (Math.random() - 0.5) * spread * speed;
        vel.z += (Math.random() - 0.5) * spread * speed;
      } else {
        vel.set(
          (Math.random() - 0.5) * spread * speed,
          (Math.random() - 0.5) * spread * speed,
          (Math.random() - 0.5) * spread * speed
        );
      }

      this.particles.push({
        position: position.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
          )
        ),
        velocity: vel,
        color: c.clone(),
        size: size * (0.5 + Math.random() * 0.5),
        life,
        maxLife: life,
        opacity: 1.0,
        decay: gravity,
      });
    }
  }

  /** Emit a projectile trail */
  emitTrail(position: THREE.Vector3, color: string | number, weaponType: string): void {
    const trailConfig: Record<string, { count: number; size: number; speed: number; life: number }> = {
      plasma: { count: 2, size: 1.5, speed: 0.5, life: 0.3 },
      railgun: { count: 3, size: 1.0, speed: 0.2, life: 0.5 },
      scatter: { count: 1, size: 1.0, speed: 0.3, life: 0.2 },
      missile: { count: 4, size: 2.0, speed: 1.0, life: 0.6 },
      beam: { count: 2, size: 0.8, speed: 0.1, life: 0.2 },
      nova: { count: 3, size: 1.8, speed: 0.8, life: 0.4 },
    };
    const cfg = trailConfig[weaponType] || trailConfig.plasma;

    this.emit({
      position,
      count: cfg.count,
      color,
      speed: cfg.speed,
      size: cfg.size,
      life: cfg.life,
      spread: 0.3,
    });
  }

  /** Emit hit impact sparks */
  emitHitSparks(position: THREE.Vector3, color: string | number): void {
    this.emit({
      position,
      count: 15,
      color,
      speed: 5,
      size: 1.5,
      life: 0.4,
      spread: 1.0,
      gravity: -5,
    });
  }

  /** Emit death/elimination explosion */
  emitDeathExplosion(position: THREE.Vector3, color: string | number): void {
    // Core burst
    this.emit({
      position,
      count: 40,
      color,
      speed: 8,
      size: 3.0,
      life: 0.8,
      spread: 1.0,
    });
    // White flash core
    this.emit({
      position,
      count: 15,
      color: 0xffffff,
      speed: 3,
      size: 4.0,
      life: 0.3,
      spread: 0.5,
    });
    // Ember fallout
    this.emit({
      position,
      count: 20,
      color,
      speed: 2,
      size: 1.0,
      life: 1.5,
      spread: 0.8,
      gravity: -3,
    });
  }

  /** Emit ambient floating particles */
  emitAmbient(arenaRadius: number): void {
    const colors = [0x00f0ff, 0xff00aa, 0x39ff14, 0x7b2fff];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * arenaRadius;
    const pos = new THREE.Vector3(
      Math.cos(angle) * r,
      0.5 + Math.random() * 4,
      Math.sin(angle) * r
    );

    this.emit({
      position: pos,
      count: 1,
      color,
      speed: 0.3,
      size: 0.8,
      life: 3.0,
      spread: 0.2,
      direction: new THREE.Vector3(0, 1, 0),
    });
  }

  /** Update all particles — call each frame */
  update(dt: number): void {
    // Update particle physics
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.position.addScaledVector(p.velocity, dt);
      p.velocity.y += p.decay * dt;
      p.velocity.multiplyScalar(1 - dt * 2); // drag
      p.opacity = Math.max(0, p.life / p.maxLife);
    }

    // Update GPU buffers
    const posAttr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const sizeAttr = this.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const opacityAttr = this.geometry.getAttribute("aOpacity") as THREE.BufferAttribute;
    const colorAttr = this.geometry.getAttribute("aColor") as THREE.BufferAttribute;

    for (let i = 0; i < this.maxParticles; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i];
        posAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);
        sizeAttr.setX(i, p.size);
        opacityAttr.setX(i, p.opacity);
        colorAttr.setXYZ(i, p.color.r, p.color.g, p.color.b);
      } else {
        posAttr.setXYZ(i, 0, -100, 0); // hide unused
        sizeAttr.setX(i, 0);
        opacityAttr.setX(i, 0);
      }
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    this.geometry.setDrawRange(0, Math.min(this.particles.length, this.maxParticles));
  }

  /** Dispose all GPU resources */
  dispose(scene: THREE.Scene): void {
    scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.particles = [];
  }
}

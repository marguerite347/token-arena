/**
 * HolographicMaterial — Cyberpunk holographic shader for Three.js
 * Based on ektogamat/threejs-vanilla-holographic-material (MIT)
 * Adapted for Token Arena with custom scanline, fresnel, and glow effects
 */
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform float uGlitchIntensity;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);

    vec3 pos = position;

    // Glitch displacement
    float glitch = step(0.95, sin(uTime * 20.0 + position.y * 10.0)) * uGlitchIntensity;
    pos.x += glitch * (sin(uTime * 100.0) * 0.1);

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform vec3 uColor;
  uniform float uFresnelAmount;
  uniform float uFresnelOpacity;
  uniform float uScanlineSize;
  uniform float uBrightness;
  uniform float uSignalSpeed;
  uniform float uOpacity;
  uniform bool uEnableBlinking;
  uniform bool uBlinkFresnelOnly;
  uniform bool uEnableAdditive;

  void main() {
    // Fresnel effect
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);
    fresnel = mix(0.0, fresnel, uFresnelAmount);

    // Scanlines
    float scanline = sin(vPosition.y * uScanlineSize + uTime * uSignalSpeed) * 0.5 + 0.5;
    scanline = smoothstep(0.3, 0.7, scanline);

    // Horizontal scan bar
    float scanBar = smoothstep(0.0, 0.15, abs(sin(uTime * 0.8) - vUv.y));

    // Blinking
    float blink = 1.0;
    if (uEnableBlinking) {
      blink = step(0.5, sin(uTime * 3.0) * 0.5 + 0.5);
      if (uBlinkFresnelOnly) {
        fresnel *= blink;
        blink = 1.0;
      }
    }

    // Combine
    float alpha = (scanline * 0.7 + fresnel * uFresnelOpacity + 0.3) * uOpacity * blink * scanBar;
    alpha = clamp(alpha, 0.0, 1.0);

    vec3 color = uColor * uBrightness;
    color += fresnel * uColor * 0.5;

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface HolographicMaterialOptions {
  color?: string;
  fresnelAmount?: number;
  fresnelOpacity?: number;
  scanlineSize?: number;
  brightness?: number;
  signalSpeed?: number;
  opacity?: number;
  enableBlinking?: boolean;
  blinkFresnelOnly?: boolean;
  enableAdditive?: boolean;
  glitchIntensity?: number;
  side?: THREE.Side;
}

export function createHolographicMaterial(options: HolographicMaterialOptions = {}): THREE.ShaderMaterial {
  const color = new THREE.Color(options.color ?? "#00d5ff");

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uFresnelAmount: { value: options.fresnelAmount ?? 0.45 },
      uFresnelOpacity: { value: options.fresnelOpacity ?? 1.0 },
      uScanlineSize: { value: options.scanlineSize ?? 8.0 },
      uBrightness: { value: options.brightness ?? 1.2 },
      uSignalSpeed: { value: options.signalSpeed ?? 0.45 },
      uOpacity: { value: options.opacity ?? 1.0 },
      uEnableBlinking: { value: options.enableBlinking ?? false },
      uBlinkFresnelOnly: { value: options.blinkFresnelOnly ?? true },
      uEnableAdditive: { value: options.enableAdditive ?? true },
      uGlitchIntensity: { value: options.glitchIntensity ?? 0.0 },
    },
    transparent: true,
    depthWrite: false,
    blending: (options.enableAdditive ?? true) ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: options.side ?? THREE.DoubleSide,
  });

  return material;
}

/** Update holographic material time uniform — call each frame */
export function updateHolographicMaterial(material: THREE.ShaderMaterial, delta: number): void {
  if (material.uniforms.uTime) {
    material.uniforms.uTime.value += delta;
  }
}

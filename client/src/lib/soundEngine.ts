/**
 * Sound Engine — Web Audio API synthesizer for Token Arena
 * All sounds are procedurally generated (no audio files needed)
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private muted = false;
  private volume = 0.5;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  private ensureCtx() {
    if (!this.ctx) this.init();
    if (this.ctx!.state === "suspended") this.ctx!.resume();
    return this.ctx!;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  // ─── Weapon Fire Sounds ─────────────────────────────────────────────────────

  playPlasmaFire() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playRailgunFire() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Charge-up whine
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(200, t);
    osc1.frequency.exponentialRampToValueAtTime(4000, t + 0.08);
    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc1.connect(gain1).connect(this.masterGain!);
    osc1.start(t);
    osc1.stop(t + 0.12);
    // Impact crack
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    noise.connect(noiseGain).connect(this.masterGain!);
    noise.start(t + 0.08);
  }

  playScatterFire() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(600 + Math.random() * 400, t + i * 0.02);
      osc.frequency.exponentialRampToValueAtTime(100, t + i * 0.02 + 0.08);
      gain.gain.setValueAtTime(0.15, t + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.02 + 0.08);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t + i * 0.02);
      osc.stop(t + i * 0.02 + 0.08);
    }
  }

  playMissileFire() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.4);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  playBeamFire() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.setValueAtTime(1250, t + 0.03);
    osc.frequency.setValueAtTime(1200, t + 0.06);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playNovaFire() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Deep boom
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.5);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.5);
    // Noise burst
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(ng).connect(this.masterGain!);
    noise.start(t);
  }

  playWeaponFire(type: string) {
    switch (type) {
      case "plasma": this.playPlasmaFire(); break;
      case "railgun": this.playRailgunFire(); break;
      case "scatter": this.playScatterFire(); break;
      case "missile": this.playMissileFire(); break;
      case "beam": this.playBeamFire(); break;
      case "nova": this.playNovaFire(); break;
      default: this.playPlasmaFire();
    }
  }

  // ─── Impact & Feedback Sounds ───────────────────────────────────────────────

  playHit() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(gain).connect(this.masterGain!);
    noise.start(t);
  }

  playKill() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    // Rising chime
    [400, 600, 800].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.2);
    });
  }

  playTokenCollect() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playDamage() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playCountdown() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playMatchStart() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [440, 660, 880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, t + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t + i * 0.1);
      osc.stop(t + i * 0.1 + 0.3);
    });
  }

  playVictory() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.5);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t + i * 0.15);
      osc.stop(t + i * 0.15 + 0.5);
    });
  }

  playDefeat() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    [400, 350, 300, 200].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, t + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.4);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.4);
    });
  }

  playPurchase() {
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(1000, t + 0.05);
    osc.frequency.setValueAtTime(1200, t + 0.1);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain).connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // ─── Ambient ────────────────────────────────────────────────────────────────

  startAmbient() {
    const ctx = this.ensureCtx();
    if (this.ambientOsc) return;
    this.ambientOsc = ctx.createOscillator();
    this.ambientGain = ctx.createGain();
    this.ambientOsc.type = "sine";
    this.ambientOsc.frequency.value = 55;
    this.ambientGain.gain.value = 0.03;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 200;
    this.ambientOsc.connect(filter).connect(this.ambientGain).connect(this.masterGain!);
    this.ambientOsc.start();
  }

  stopAmbient() {
    if (this.ambientOsc) {
      this.ambientOsc.stop();
      this.ambientOsc = null;
      this.ambientGain = null;
    }
  }

  destroy() {
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();

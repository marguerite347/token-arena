/**
 * Replay Recording & Playback Engine
 * 
 * Records match events at configurable intervals and provides
 * playback with timeline scrubbing, speed control, and auto-detected highlights.
 */

import { type Agent, type Projectile, type CombatLog, type WeaponType } from "@/contexts/GameContext";

// ─── Event Types ────────────────────────────────────────────────────────────
export type ReplayEventType =
  | "frame"        // Periodic snapshot of all positions
  | "kill"         // Agent elimination
  | "damage"       // Significant damage dealt
  | "weapon_switch"// Weapon change
  | "fire"         // Projectile fired
  | "craft"        // Item crafted
  | "token_transfer" // Token exchange
  | "match_start"  // Match begins
  | "match_end";   // Match ends

export interface ReplayFrame {
  timestamp: number; // ms since match start
  agents: AgentSnapshot[];
  projectiles: ProjectileSnapshot[];
  playerSnapshot?: AgentSnapshot;
}

export interface AgentSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  health: number;
  maxHealth: number;
  tokens: number;
  weapon: WeaponType;
  isAlive: boolean;
  kills: number;
  color: string;
}

export interface ProjectileSnapshot {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  type: WeaponType;
  color: string;
}

export interface ReplayEvent {
  type: ReplayEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface ReplayHighlight {
  timestamp: number;
  duration: number; // ms
  type: "kill" | "multi_kill" | "clutch" | "first_blood" | "last_stand" | "token_heist";
  title: string;
  description: string;
  involvedAgents: string[];
  importance: number; // 1-10
}

export interface ReplayData {
  id: string;
  matchId?: number;
  mode: string;
  startTime: number;
  endTime: number;
  duration: number;
  frames: ReplayFrame[];
  events: ReplayEvent[];
  highlights: ReplayHighlight[];
  agents: { id: string; name: string; color: string }[];
  result: string;
  skyboxUrl?: string;
  skyboxPrompt?: string;
  totalKills: number;
  mvp: { name: string; kills: number; tokens: number };
}

// ─── Replay Recorder ────────────────────────────────────────────────────────
const FRAME_INTERVAL = 100; // Record a frame every 100ms (10 fps replay)
const KILL_WINDOW = 3000;   // Multi-kill window in ms

export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private events: ReplayEvent[] = [];
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private isRecording: boolean = false;
  private mode: string = "aivai";
  private killTimestamps: Map<string, number[]> = new Map();
  private firstBloodRecorded: boolean = false;

  start(mode: string) {
    this.frames = [];
    this.events = [];
    this.startTime = Date.now();
    this.lastFrameTime = 0;
    this.isRecording = true;
    this.mode = mode;
    this.killTimestamps.clear();
    this.firstBloodRecorded = false;

    this.events.push({
      type: "match_start",
      timestamp: 0,
      data: { mode },
    });
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;
    const elapsed = Date.now() - this.startTime;
    this.events.push({
      type: "match_end",
      timestamp: elapsed,
      data: {},
    });
  }

  recordFrame(
    agents: Agent[],
    projectiles: Projectile[],
    player: Agent,
    matchTime: number,
  ): void {
    if (!this.isRecording) return;

    const elapsed = matchTime * 1000; // Convert to ms
    if (elapsed - this.lastFrameTime < FRAME_INTERVAL) return;
    this.lastFrameTime = elapsed;

    const frame: ReplayFrame = {
      timestamp: elapsed,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        x: a.x,
        y: a.y,
        z: a.z,
        rotation: a.rotation,
        health: a.health,
        maxHealth: a.maxHealth,
        tokens: a.tokens,
        weapon: a.weapon.type,
        isAlive: a.isAlive,
        kills: a.kills,
        color: a.color,
      })),
      projectiles: projectiles.map(p => ({
        id: p.id,
        ownerId: p.ownerId,
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx,
        vy: p.vy,
        vz: p.vz,
        type: p.type,
        color: p.color,
      })),
      playerSnapshot: {
        id: player.id,
        name: player.name,
        x: player.x,
        y: player.y,
        z: player.z,
        rotation: player.rotation,
        health: player.health,
        maxHealth: player.maxHealth,
        tokens: player.tokens,
        weapon: player.weapon.type,
        isAlive: player.isAlive,
        kills: player.kills,
        color: player.color,
      },
    };

    this.frames.push(frame);
  }

  recordKill(killerId: string, killerName: string, victimId: string, victimName: string, matchTime: number): void {
    if (!this.isRecording) return;
    const elapsed = matchTime * 1000;

    this.events.push({
      type: "kill",
      timestamp: elapsed,
      data: { killerId, killerName, victimId, victimName },
    });

    // Track multi-kills
    if (!this.killTimestamps.has(killerId)) {
      this.killTimestamps.set(killerId, []);
    }
    this.killTimestamps.get(killerId)!.push(elapsed);
  }

  recordWeaponSwitch(agentId: string, agentName: string, fromWeapon: string, toWeapon: string, matchTime: number): void {
    if (!this.isRecording) return;
    this.events.push({
      type: "weapon_switch",
      timestamp: matchTime * 1000,
      data: { agentId, agentName, fromWeapon, toWeapon },
    });
  }

  recordDamage(attackerId: string, victimId: string, damage: number, matchTime: number): void {
    if (!this.isRecording) return;
    // Only record significant damage
    if (damage < 15) return;
    this.events.push({
      type: "damage",
      timestamp: matchTime * 1000,
      data: { attackerId, victimId, damage },
    });
  }

  // ─── Generate Highlights ──────────────────────────────────────────────────
  private generateHighlights(agents: Agent[], player: Agent): ReplayHighlight[] {
    const highlights: ReplayHighlight[] = [];
    const killEvents = this.events.filter(e => e.type === "kill");

    // First Blood
    if (killEvents.length > 0) {
      const fb = killEvents[0];
      highlights.push({
        timestamp: Math.max(0, fb.timestamp - 2000),
        duration: 4000,
        type: "first_blood",
        title: "FIRST BLOOD",
        description: `${fb.data.killerName} eliminates ${fb.data.victimName}`,
        involvedAgents: [fb.data.killerId as string, fb.data.victimId as string],
        importance: 7,
      });
    }

    // Multi-kills (2+ kills within KILL_WINDOW)
    const killMapEntries = Array.from(this.killTimestamps.entries());
    for (const [agentId, timestamps] of killMapEntries) {
      for (let i = 0; i < timestamps.length; i++) {
        const windowKills = timestamps.filter(
          (t: number) => t >= timestamps[i] && t <= timestamps[i] + KILL_WINDOW
        );
        if (windowKills.length >= 2) {
          const agentName = killEvents.find(e => e.data.killerId === agentId)?.data.killerName || "Unknown";
          highlights.push({
            timestamp: Math.max(0, timestamps[i] - 1000),
            duration: KILL_WINDOW + 2000,
            type: "multi_kill",
            title: windowKills.length >= 3 ? "TRIPLE KILL!" : "DOUBLE KILL!",
            description: `${agentName} eliminates ${windowKills.length} agents in rapid succession`,
            involvedAgents: [agentId],
            importance: windowKills.length >= 3 ? 10 : 8,
          });
          break; // Only one multi-kill highlight per agent
        }
      }
    }

    // Last Stand (final kill when only 2 agents remain)
    const aliveAtEnd = [...agents, player].filter(a => a.isAlive);
    if (killEvents.length > 0 && aliveAtEnd.length <= 1) {
      const lastKill = killEvents[killEvents.length - 1];
      highlights.push({
        timestamp: Math.max(0, lastKill.timestamp - 3000),
        duration: 5000,
        type: "last_stand",
        title: "FINAL ELIMINATION",
        description: `${lastKill.data.killerName} claims victory by eliminating ${lastKill.data.victimName}`,
        involvedAgents: [lastKill.data.killerId as string, lastKill.data.victimId as string],
        importance: 9,
      });
    }

    // Clutch (agent with <20% HP gets a kill)
    for (const kill of killEvents) {
      const frameAtKill = this.frames.find(f => Math.abs(f.timestamp - kill.timestamp) < 200);
      if (frameAtKill) {
        const killerSnapshot = frameAtKill.agents.find(a => a.id === kill.data.killerId) || 
          (frameAtKill.playerSnapshot?.id === kill.data.killerId ? frameAtKill.playerSnapshot : null);
        if (killerSnapshot && killerSnapshot.health / killerSnapshot.maxHealth < 0.2) {
          highlights.push({
            timestamp: Math.max(0, kill.timestamp - 2000),
            duration: 4000,
            type: "clutch",
            title: "CLUTCH ELIMINATION",
            description: `${kill.data.killerName} eliminates ${kill.data.victimName} with only ${Math.round(killerSnapshot.health)} HP remaining!`,
            involvedAgents: [kill.data.killerId as string, kill.data.victimId as string],
            importance: 8,
          });
        }
      }
    }

    // Sort by importance, then timestamp
    highlights.sort((a, b) => b.importance - a.importance || a.timestamp - b.timestamp);

    // Deduplicate overlapping highlights (keep higher importance)
    const filtered: ReplayHighlight[] = [];
    for (const h of highlights) {
      const overlaps = filtered.some(
        f => Math.abs(f.timestamp - h.timestamp) < 2000
      );
      if (!overlaps) filtered.push(h);
    }

    return filtered.slice(0, 8); // Max 8 highlights
  }

  // ─── Finalize Replay ──────────────────────────────────────────────────────
  finalize(agents: Agent[], player: Agent, result: string, skyboxUrl?: string, skyboxPrompt?: string): ReplayData {
    this.stop();

    const allCombatants = [...agents, player];
    const killEvents = this.events.filter(e => e.type === "kill");
    
    // Find MVP
    let mvpAgent = player;
    let mvpScore = player.kills * 10 + player.tokens;
    for (const a of agents) {
      const score = a.kills * 10 + a.tokens;
      if (score > mvpScore) {
        mvpScore = score;
        mvpAgent = a;
      }
    }

    const highlights = this.generateHighlights(agents, player);

    return {
      id: `replay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      mode: this.mode,
      startTime: this.startTime,
      endTime: Date.now(),
      duration: this.frames.length > 0 ? this.frames[this.frames.length - 1].timestamp : 0,
      frames: this.frames,
      events: this.events,
      highlights,
      agents: allCombatants.map(a => ({ id: a.id, name: a.name, color: a.color })),
      result,
      skyboxUrl,
      skyboxPrompt,
      totalKills: killEvents.length,
      mvp: {
        name: mvpAgent.name,
        kills: mvpAgent.kills,
        tokens: mvpAgent.tokens,
      },
    };
  }
}

// ─── Replay Player ──────────────────────────────────────────────────────────
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number; // ms
  speed: PlaybackSpeed;
  duration: number;
  currentFrame: ReplayFrame | null;
  activeHighlight: ReplayHighlight | null;
  isSlowMo: boolean;
}

export class ReplayPlayer {
  private replay: ReplayData;
  private currentFrameIndex: number = 0;
  private _state: PlaybackState;
  private onStateChange: ((state: PlaybackState) => void) | null = null;

  constructor(replay: ReplayData) {
    this.replay = replay;
    this._state = {
      isPlaying: false,
      currentTime: 0,
      speed: 1,
      duration: replay.duration,
      currentFrame: replay.frames[0] || null,
      activeHighlight: null,
      isSlowMo: false,
    };
  }

  get state(): PlaybackState {
    return { ...this._state };
  }

  get data(): ReplayData {
    return this.replay;
  }

  setOnStateChange(cb: (state: PlaybackState) => void) {
    this.onStateChange = cb;
  }

  private emit() {
    this.onStateChange?.(this.state);
  }

  play() {
    this._state.isPlaying = true;
    this.emit();
  }

  pause() {
    this._state.isPlaying = false;
    this.emit();
  }

  togglePlay() {
    this._state.isPlaying = !this._state.isPlaying;
    this.emit();
  }

  setSpeed(speed: PlaybackSpeed) {
    this._state.speed = speed;
    this._state.isSlowMo = speed < 1;
    this.emit();
  }

  seekTo(timeMs: number) {
    this._state.currentTime = Math.max(0, Math.min(timeMs, this.replay.duration));
    this.updateFrame();
    this.emit();
  }

  seekToHighlight(index: number) {
    if (index >= 0 && index < this.replay.highlights.length) {
      const h = this.replay.highlights[index];
      this.seekTo(h.timestamp);
      this._state.speed = 0.5; // Auto slow-mo for highlights
      this._state.isSlowMo = true;
      this._state.isPlaying = true;
      this.emit();
    }
  }

  // Called each animation frame
  tick(deltaMs: number) {
    if (!this._state.isPlaying) return;

    const advance = deltaMs * this._state.speed;
    this._state.currentTime += advance;

    // Check if we're in a highlight zone — auto slow-mo
    const activeHighlight = this.replay.highlights.find(
      h => this._state.currentTime >= h.timestamp && 
           this._state.currentTime <= h.timestamp + h.duration
    );
    this._state.activeHighlight = activeHighlight || null;

    if (this._state.currentTime >= this.replay.duration) {
      this._state.currentTime = this.replay.duration;
      this._state.isPlaying = false;
    }

    this.updateFrame();
    this.emit();
  }

  private updateFrame() {
    // Binary search for the closest frame
    const frames = this.replay.frames;
    if (frames.length === 0) return;

    let lo = 0, hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (frames[mid].timestamp <= this._state.currentTime) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    this.currentFrameIndex = lo;
    this._state.currentFrame = frames[lo];
  }

  getEventsInRange(startMs: number, endMs: number): ReplayEvent[] {
    return this.replay.events.filter(
      e => e.timestamp >= startMs && e.timestamp <= endMs
    );
  }

  getProgress(): number {
    if (this.replay.duration === 0) return 0;
    return this._state.currentTime / this.replay.duration;
  }
}

// ─── Singleton Recorder ─────────────────────────────────────────────────────
let activeRecorder: ReplayRecorder | null = null;

export function getActiveRecorder(): ReplayRecorder | null {
  return activeRecorder;
}

export function startRecording(mode: string): ReplayRecorder {
  activeRecorder = new ReplayRecorder();
  activeRecorder.start(mode);
  return activeRecorder;
}

export function stopRecording(): ReplayRecorder | null {
  const recorder = activeRecorder;
  activeRecorder = null;
  return recorder;
}

// ─── Replay Storage (in-memory for now, with localStorage backup) ───────────
const MAX_STORED_REPLAYS = 10;
const STORAGE_KEY = "token-arena-replays";

export function saveReplay(replay: ReplayData): void {
  try {
    // Compress frames — only keep every 3rd frame for storage
    const compressed = {
      ...replay,
      frames: replay.frames.filter((_, i) => i % 3 === 0),
    };
    
    const stored = getStoredReplays();
    stored.unshift(compressed);
    if (stored.length > MAX_STORED_REPLAYS) stored.pop();
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full — remove oldest
    try {
      const stored = getStoredReplays();
      if (stored.length > 2) {
        stored.pop();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      }
    } catch {
      // Give up on storage
    }
  }
}

export function getStoredReplays(): ReplayData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function deleteReplay(id: string): void {
  const stored = getStoredReplays();
  const filtered = stored.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getReplayShareUrl(replayId: string): string {
  return `${window.location.origin}/replay/${replayId}`;
}

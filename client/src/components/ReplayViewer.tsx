/**
 * ReplayViewer — Full replay playback UI with timeline, speed controls,
 * highlight markers, slow-mo indicators, and agent stats overlay.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ReplayPlayer, type PlaybackSpeed, type PlaybackState, type ReplayData, type ReplayHighlight } from "@/lib/replayEngine";

interface ReplayViewerProps {
  replay: ReplayData;
  onClose: () => void;
  onShare?: (replayId: string) => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS: PlaybackSpeed[] = [0.25, 0.5, 1, 2, 4];

export default function ReplayViewer({ replay, onClose, onShare }: ReplayViewerProps) {
  const [player] = useState(() => new ReplayPlayer(replay));
  const [playbackState, setPlaybackState] = useState<PlaybackState>(player.state);
  const animRef = useRef(0);
  const lastTimeRef = useRef(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showHighlightPanel, setShowHighlightPanel] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    player.setOnStateChange(setPlaybackState);
    player.play(); // Auto-play

    const loop = (time: number) => {
      const delta = lastTimeRef.current ? time - lastTimeRef.current : 16;
      lastTimeRef.current = time;
      player.tick(delta);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [player]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    player.seekTo(pct * replay.duration);
  }, [player, replay.duration]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/replay/${replay.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    onShare?.(replay.id);
  }, [replay.id, onShare]);

  const frame = playbackState.currentFrame;
  const progress = replay.duration > 0 ? playbackState.currentTime / replay.duration : 0;

  // Get recent events for the event feed
  const recentEvents = player.getEventsInRange(
    Math.max(0, playbackState.currentTime - 5000),
    playbackState.currentTime
  ).filter(e => e.type === "kill" || e.type === "weapon_switch");

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/80 border-b border-cyan-500/20">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="text-cyan-400 hover:text-cyan-300 font-mono text-sm px-3 py-1 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition-colors"
          >
            ← BACK
          </button>
          <div className="font-mono">
            <span className="text-cyan-400 text-sm">REPLAY</span>
            <span className="text-gray-500 text-xs ml-2">
              {new Date(replay.startTime).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-400">
            {replay.mode.toUpperCase()} • {replay.totalKills} KILLS • MVP: {replay.mvp.name}
          </span>
          <button
            onClick={handleShare}
            className="text-xs font-mono px-3 py-1 border border-pink-500/30 text-pink-400 rounded hover:bg-pink-500/10 transition-colors"
          >
            {copied ? "✓ COPIED" : "⎘ SHARE"}
          </button>
        </div>
      </div>

      {/* Main viewport */}
      <div className="flex-1 relative overflow-hidden">
        {/* 2D Mini-map replay view */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[600px] h-[600px] max-w-[80vh] max-h-[80vh]">
            {/* Arena grid */}
            <svg viewBox="-20 -20 40 40" className="w-full h-full">
              {/* Grid lines */}
              {Array.from({ length: 9 }, (_, i) => {
                const pos = -16 + i * 4;
                return (
                  <g key={`grid-${i}`}>
                    <line x1={pos} y1={-20} x2={pos} y2={20} stroke="#0a1628" strokeWidth="0.1" />
                    <line x1={-20} y1={pos} x2={20} y2={pos} stroke="#0a1628" strokeWidth="0.1" />
                  </g>
                );
              })}
              {/* Arena boundary */}
              <circle cx={0} cy={0} r={18} fill="none" stroke="#00f0ff" strokeWidth="0.15" opacity={0.3} />
              <circle cx={0} cy={0} r={19} fill="none" stroke="#00f0ff" strokeWidth="0.05" opacity={0.15} />

              {/* Projectiles */}
              {frame?.projectiles.map(p => (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.z}
                  r={0.2}
                  fill={p.color}
                  opacity={0.7}
                />
              ))}

              {/* Agents */}
              {frame?.agents.filter(a => a.isAlive).map(a => (
                <g key={a.id}>
                  {/* Agent glow */}
                  <circle cx={a.x} cy={a.z} r={1.2} fill={a.color} opacity={0.1} />
                  {/* Agent body */}
                  <circle cx={a.x} cy={a.z} r={0.5} fill={a.color} opacity={0.9} />
                  {/* Direction indicator */}
                  <line
                    x1={a.x}
                    y1={a.z}
                    x2={a.x + Math.sin(a.rotation) * 1.2}
                    y2={a.z + Math.cos(a.rotation) * 1.2}
                    stroke={a.color}
                    strokeWidth="0.15"
                  />
                  {/* Health bar */}
                  <rect x={a.x - 0.6} y={a.z - 1} width={1.2} height={0.15} fill="#111" rx={0.05} />
                  <rect
                    x={a.x - 0.6}
                    y={a.z - 1}
                    width={1.2 * (a.health / a.maxHealth)}
                    height={0.15}
                    fill={a.health / a.maxHealth > 0.5 ? "#39ff14" : a.health / a.maxHealth > 0.25 ? "#ffb800" : "#ff3333"}
                    rx={0.05}
                  />
                  {/* Name */}
                  <text
                    x={a.x}
                    y={a.z - 1.3}
                    textAnchor="middle"
                    fill={a.color}
                    fontSize="0.6"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {a.name}
                  </text>
                </g>
              ))}

              {/* Dead agents (X markers) */}
              {frame?.agents.filter(a => !a.isAlive).map(a => (
                <g key={`dead-${a.id}`} opacity={0.3}>
                  <line x1={a.x - 0.4} y1={a.z - 0.4} x2={a.x + 0.4} y2={a.z + 0.4} stroke={a.color} strokeWidth="0.15" />
                  <line x1={a.x + 0.4} y1={a.z - 0.4} x2={a.x - 0.4} y2={a.z + 0.4} stroke={a.color} strokeWidth="0.15" />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Slow-mo indicator */}
        <AnimatePresence>
          {playbackState.isSlowMo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-pink-500/20 border border-pink-500/40 rounded font-mono text-pink-400 text-sm"
            >
              ◆ SLOW MOTION ×{playbackState.speed}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active highlight banner */}
        <AnimatePresence>
          {playbackState.activeHighlight && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-12 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-cyan-500/20 via-pink-500/20 to-cyan-500/20 border border-cyan-500/40 rounded-lg"
            >
              <div className="text-center">
                <div className="text-cyan-400 font-mono font-bold text-lg tracking-wider">
                  {playbackState.activeHighlight.title}
                </div>
                <div className="text-gray-400 font-mono text-xs mt-1">
                  {playbackState.activeHighlight.description}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent stats sidebar */}
        <div className="absolute right-4 top-4 w-48 space-y-1">
          {frame?.agents.map(a => (
            <div
              key={a.id}
              className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
                a.isAlive
                  ? "bg-black/60 border-gray-700"
                  : "bg-black/30 border-gray-800 opacity-40 line-through"
              }`}
            >
              <div className="flex justify-between items-center">
                <span style={{ color: a.color }}>{a.name}</span>
                <span className="text-gray-500">{a.kills}K</span>
              </div>
              <div className="flex gap-2 text-[10px] text-gray-500">
                <span>HP:{Math.round(a.health)}</span>
                <span>TKN:{a.tokens}</span>
                <span>{a.weapon.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Event feed */}
        <div className="absolute left-4 bottom-24 w-64 space-y-1">
          <AnimatePresence>
            {recentEvents.slice(-5).map((e, i) => (
              <motion.div
                key={`${e.type}-${e.timestamp}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs font-mono px-2 py-1 bg-black/60 rounded border border-gray-800"
              >
                {e.type === "kill" && (
                  <span className="text-red-400">
                    ☠ {e.data.killerName as string} → {e.data.victimName as string}
                  </span>
                )}
                {e.type === "weapon_switch" && (
                  <span className="text-yellow-400">
                    ⚡ {e.data.agentName as string} → {(e.data.toWeapon as string).toUpperCase()}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Highlights panel */}
      {showHighlightPanel && replay.highlights.length > 0 && (
        <div className="absolute right-4 bottom-28 w-56 bg-black/80 border border-cyan-500/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-cyan-500/10 border-b border-cyan-500/20">
            <span className="text-xs font-mono text-cyan-400">HIGHLIGHTS</span>
            <button
              onClick={() => setShowHighlightPanel(false)}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {replay.highlights.map((h, i) => (
              <button
                key={i}
                onClick={() => player.seekToHighlight(i)}
                className="w-full text-left px-3 py-1.5 hover:bg-cyan-500/10 transition-colors border-b border-gray-800/50 last:border-0"
              >
                <div className="text-xs font-mono text-cyan-300">{h.title}</div>
                <div className="text-[10px] text-gray-500 truncate">{h.description}</div>
                <div className="text-[10px] text-gray-600">{formatTime(h.timestamp)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playback controls */}
      <div className="bg-black/90 border-t border-cyan-500/20 px-4 py-3">
        {/* Timeline */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-6 mb-2 cursor-pointer group"
        >
          {/* Timeline track */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-gray-800 rounded-full">
            {/* Progress */}
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Highlight markers */}
          {replay.highlights.map((h, i) => {
            const pos = replay.duration > 0 ? (h.timestamp / replay.duration) * 100 : 0;
            return (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-yellow-400 border border-yellow-600 cursor-pointer hover:scale-150 transition-transform"
                style={{ left: `${pos}%` }}
                title={h.title}
                onClick={(e) => {
                  e.stopPropagation();
                  player.seekToHighlight(i);
                }}
              />
            );
          })}

          {/* Kill event markers */}
          {replay.events
            .filter(e => e.type === "kill")
            .map((e, i) => {
              const pos = replay.duration > 0 ? (e.timestamp / replay.duration) * 100 : 0;
              return (
                <div
                  key={`kill-${i}`}
                  className="absolute top-0 w-0.5 h-full bg-red-500/40"
                  style={{ left: `${pos}%` }}
                />
              );
            })}

          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-cyan-500/50 transition-all duration-100"
            style={{ left: `${progress * 100}%`, transform: "translate(-50%, -50%)" }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={() => player.togglePlay()}
              className="w-8 h-8 flex items-center justify-center rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors font-mono"
            >
              {playbackState.isPlaying ? "⏸" : "▶"}
            </button>

            {/* Speed controls */}
            <div className="flex items-center gap-1">
              {SPEED_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => player.setSpeed(s)}
                  className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                    playbackState.speed === s
                      ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                      : "text-gray-500 hover:text-gray-300 border border-transparent"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            {/* Time display */}
            <span className="text-xs font-mono text-gray-400">
              {formatTime(playbackState.currentTime)} / {formatTime(replay.duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!showHighlightPanel && replay.highlights.length > 0 && (
              <button
                onClick={() => setShowHighlightPanel(true)}
                className="text-xs font-mono text-yellow-400 hover:text-yellow-300 px-2 py-1 border border-yellow-500/30 rounded"
              >
                ★ {replay.highlights.length} HIGHLIGHTS
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

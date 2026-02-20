/**
 * ReplayList — Browse and manage saved match replays
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type ReplayData, getStoredReplays, deleteReplay } from "@/lib/replayEngine";

interface ReplayListProps {
  onSelectReplay: (replay: ReplayData) => void;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ReplayList({ onSelectReplay, onClose }: ReplayListProps) {
  const [replays, setReplays] = useState<ReplayData[]>(() => getStoredReplays());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteReplay(id);
    setReplays(getStoredReplays());
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-mono text-cyan-400 tracking-wider">
          MATCH REPLAYS
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 font-mono text-sm"
        >
          ✕ CLOSE
        </button>
      </div>

      {replays.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
          <div className="text-gray-500 font-mono text-sm">NO REPLAYS SAVED</div>
          <div className="text-gray-600 text-xs mt-2">
            Complete a match to save a replay automatically
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {replays.map((replay, i) => (
              <motion.div
                key={replay.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
                className="bg-black/40 border border-gray-800 rounded-lg p-3 hover:border-cyan-500/30 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => onSelectReplay(replay)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        replay.result === "victory"
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}>
                        {replay.result.toUpperCase()}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        {replay.mode.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600">
                        {formatDate(replay.startTime)}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="text-gray-400">
                        ⏱ {formatDuration(replay.duration)}
                      </span>
                      <span className="text-red-400">
                        ☠ {replay.totalKills} kills
                      </span>
                      <span className="text-yellow-400">
                        ★ {replay.highlights.length} highlights
                      </span>
                      <span className="text-cyan-400">
                        MVP: {replay.mvp.name} ({replay.mvp.kills}K)
                      </span>
                    </div>

                    {/* Agent roster */}
                    <div className="flex gap-1 mt-2">
                      {replay.agents.map(a => (
                        <span
                          key={a.id}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: a.color + "15",
                            color: a.color,
                            border: `1px solid ${a.color}30`,
                          }}
                        >
                          {a.name}
                        </span>
                      ))}
                    </div>
                  </button>

                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => onSelectReplay(replay)}
                      className="text-xs font-mono px-2 py-1 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ▶ PLAY
                    </button>
                    {confirmDelete === replay.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDelete(replay.id)}
                          className="text-xs font-mono px-2 py-1 text-red-400 border border-red-500/30 rounded hover:bg-red-500/10"
                        >
                          YES
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs font-mono px-2 py-1 text-gray-400 border border-gray-600 rounded hover:bg-gray-500/10"
                        >
                          NO
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(replay.id)}
                        className="text-xs font-mono px-2 py-1 text-gray-600 border border-gray-700 rounded hover:text-red-400 hover:border-red-500/30 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="text-center text-xs text-gray-600 font-mono">
        {replays.length}/{10} REPLAY SLOTS USED
      </div>
    </div>
  );
}

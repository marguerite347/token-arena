/**
 * Replays Page — Match Replay Listing and Viewer
 * 
 * Browse all recorded matches with play-by-play logs, highlights, and combat events.
 * Click to view full replay with 2D minimap and timeline.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";

const AGENT_LLM_MAP: Record<string, { icon: string; label: string; color: string }> = {
  "NEXUS-7": { icon: "⚡", label: "GPT-4o", color: "#10b981" },
  "PHANTOM": { icon: "🧠", label: "Claude", color: "#d97706" },
  "TITAN": { icon: "🦙", label: "Llama", color: "#8b5cf6" },
  "CIPHER": { icon: "🌬️", label: "Mistral", color: "#3b82f6" },
  "AURORA": { icon: "✨", label: "Gemini", color: "#06b6d4" },
  "WRAITH": { icon: "🔮", label: "DeepSeek", color: "#ec4899" },
  "ECHO": { icon: "🧠", label: "Claude", color: "#d97706" },
  "VIPER": { icon: "⚡", label: "GPT-4o", color: "#10b981" },
  "SENTINEL": { icon: "🌬️", label: "Mistral", color: "#3b82f6" },
};

interface ReplayCard {
  id: number;
  replayId: string;
  matchId: number | null;
  mode: string;
  duration: number;
  totalKills: number;
  mvpName: string | null;
  mvpKills: number;
  mvpTokens: number;
  result: string | null;
  agents: any;
  createdAt: Date;
  [key: string]: any;
}

export default function Replays() {
  const [, navigate] = useLocation();
  const [selectedFilter, setSelectedFilter] = useState<"all" | "aivai" | "pvp">("all");

  const { data: replays, isLoading } = trpc.replay.list.useQuery(
    { limit: 50 },
    { staleTime: 30000 }
  );

  const filteredReplays = replays?.filter((r: ReplayCard) => 
    selectedFilter === "all" || r.mode === selectedFilter
  ) || [];

  return (
    <div className="min-h-screen relative bg-background">
      <div className="fixed inset-0 scanline-overlay opacity-10 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="text-xs font-mono text-muted-foreground hover:text-neon-cyan transition-colors">
              ← LOBBY
            </button>
            <div className="w-px h-6 bg-border/30" />
            <h1 className="font-display text-xl font-bold text-neon-cyan tracking-wider" style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}>
              MATCH REPLAYS
            </h1>
            <span className="text-[9px] font-mono text-muted-foreground/60 bg-neon-cyan/5 px-2 py-0.5 border border-neon-cyan/10">
              {filteredReplays.length} MATCHES RECORDED
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/betting")}
              className="clip-brutal-sm px-3 py-1.5 bg-neon-magenta/10 border border-neon-magenta/30 text-neon-magenta font-mono text-xs hover:bg-neon-magenta/20 transition-colors"
            >
              BETTING
            </button>
            <button
              onClick={() => navigate("/arena")}
              className="clip-brutal-sm px-3 py-1.5 bg-neon-green/10 border border-neon-green/30 text-neon-green font-mono text-xs hover:bg-neon-green/20 transition-colors"
            >
              ARENA
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-border/20">
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-gray-500 uppercase">FILTER:</span>
            {(["all", "aivai", "pvp"] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`clip-brutal-sm px-3 py-1.5 font-mono text-xs transition-colors ${
                  selectedFilter === filter
                    ? "bg-neon-cyan/20 border border-neon-cyan/60 text-neon-cyan"
                    : "bg-gray-900/50 border border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {filter === "all" ? "ALL MATCHES" : filter === "aivai" ? "AI vs AI" : "PvP"}
              </button>
            ))}
          </div>
        </div>

        {/* Replays Grid */}
        <div className="flex-1 px-6 py-8">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground font-mono text-sm">Loading replays...</div>
          ) : filteredReplays.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📹</div>
              <div className="text-muted-foreground font-mono text-sm mb-2">No replays found</div>
              <div className="text-[10px] font-mono text-muted-foreground/60">
                Run AI playtests or play matches to generate replays
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReplays.map((replay: ReplayCard, i: number) => (
                <motion.div
                  key={replay.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/replay/${replay.replayId}`)}
                  className="hud-panel clip-brutal p-4 cursor-pointer hover:border-neon-cyan/40 transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 uppercase">
                          {replay.mode === "aivai" ? "AI vs AI" : "PvP"}
                        </span>
                        <span className="text-[9px] font-mono text-gray-600">
                          {Math.round(replay.duration / 1000)}s
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-gray-500">
                        {new Date(replay.createdAt).toLocaleDateString()} {new Date(replay.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-mono text-neon-green font-bold">
                        {replay.totalKills} KILLS
                      </div>
                      {replay.mvpName && (
                        <div className="text-[9px] font-mono text-neon-amber">
                          MVP: {replay.mvpName}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agents with LLM badges */}
                  <div className="mb-3 pb-3 border-b border-gray-800">
                    <div className="text-[8px] font-mono text-gray-600 uppercase mb-1">Participants</div>
                    <div className="flex flex-wrap gap-1.5">
                      {replay.agents?.map((agent: any, idx: number) => {
                        const llm = AGENT_LLM_MAP[agent.name];
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 bg-gray-900 border"
                            style={{ borderColor: llm ? `${llm.color}40` : "#374151" }}
                          >
                            {llm && <span className="text-xs">{llm.icon}</span>}
                            <span className="text-gray-300">{agent.name}</span>
                            {llm && (
                              <span className="text-[8px]" style={{ color: llm.color }}>{llm.label}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Result */}
                  {replay.result && (
                    <div className="text-[9px] font-mono text-gray-500">
                      {replay.result}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <div className="text-[9px] font-mono text-neon-cyan hover:text-neon-cyan/80 transition-colors">
                      WATCH REPLAY →
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-gray-600">
              {filteredReplays.length} replays · Click to view full play-by-play
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                REPLAY ENGINE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

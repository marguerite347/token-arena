/*
 * Leaderboard & Match History Page
 * Design: Neon Brutalism — data-heavy tables with neon accents
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";

type Tab = "leaderboard" | "history";

export default function Leaderboard() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("leaderboard");

  const { data: leaderboardData, isLoading: lbLoading } = trpc.leaderboard.get.useQuery({});
  const { data: matchHistory, isLoading: mhLoading } = trpc.match.recent.useQuery({});

  return (
    <div className="min-h-screen relative bg-background">
      <div className="fixed inset-0 scanline-overlay opacity-10 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="text-xs font-mono text-muted-foreground hover:text-neon-cyan transition-colors"
            >
              ← LOBBY
            </button>
            <div className="w-px h-6 bg-border/30" />
            <h1 className="font-display text-xl font-bold text-neon-cyan text-glow-cyan tracking-wider">
              RANKINGS
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/arena")}
              className="clip-brutal-sm px-4 py-1.5 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan font-mono text-xs hover:bg-neon-cyan/20 transition-colors"
            >
              ENTER ARENA
            </button>
          </div>
        </header>

        {/* Tab switcher */}
        <div className="px-6 py-4 flex gap-2">
          {(["leaderboard", "history"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`clip-brutal-sm px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-neon-cyan/10 border border-neon-cyan/40 text-neon-cyan"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {tab === "leaderboard" ? "LEADERBOARD" : "MATCH HISTORY"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-6 pb-8">
          {activeTab === "leaderboard" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="hud-panel clip-brutal overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">#</th>
                      <th className="text-left text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Player</th>
                      <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Matches</th>
                      <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Wins</th>
                      <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Kills</th>
                      <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Deaths</th>
                      <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">K/D</th>
                      <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Tokens Earned</th>
                      <th className="text-right text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-4 py-3">Weapon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbLoading ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-muted-foreground font-mono text-sm">
                          Loading rankings...
                        </td>
                      </tr>
                    ) : !leaderboardData || leaderboardData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12">
                          <div className="text-muted-foreground font-mono text-sm mb-2">No rankings yet</div>
                          <div className="text-[10px] font-mono text-muted-foreground/60">
                            Complete a match to appear on the leaderboard
                          </div>
                        </td>
                      </tr>
                    ) : (
                      leaderboardData.map((entry, i) => {
                        const kd = entry.totalDeaths > 0 ? (entry.totalKills / entry.totalDeaths).toFixed(2) : entry.totalKills.toString();
                        const rankColor = i === 0 ? "#FFB800" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : undefined;
                        return (
                          <tr key={entry.id} className="border-b border-border/10 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-display text-sm" style={rankColor ? { color: rankColor } : {}}>
                              {i + 1}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-sm text-foreground">{entry.playerName}</div>
                              {entry.walletAddress && (
                                <div className="text-[9px] font-mono text-muted-foreground/50">
                                  {entry.walletAddress.slice(0, 6)}...{entry.walletAddress.slice(-4)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{entry.totalMatches}</td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-neon-green">{entry.totalWins}</td>
                            <td className="px-4 py-3 text-right font-display text-sm text-neon-magenta">{entry.totalKills}</td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{entry.totalDeaths}</td>
                            <td className="px-4 py-3 text-right font-mono text-xs text-neon-cyan">{kd}</td>
                            <td className="px-4 py-3 text-right font-display text-sm text-neon-green">{entry.totalTokensEarned}</td>
                            <td className="px-4 py-3 text-right font-mono text-[10px] text-muted-foreground uppercase">{entry.favoriteWeapon || "-"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="space-y-3">
                {mhLoading ? (
                  <div className="text-center py-12 text-muted-foreground font-mono text-sm">Loading match history...</div>
                ) : !matchHistory || matchHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground font-mono text-sm mb-2">No matches recorded</div>
                    <div className="text-[10px] font-mono text-muted-foreground/60">Play a match to see your history here</div>
                  </div>
                ) : (
                  matchHistory.map((match) => (
                    <div key={match.id} className="hud-panel clip-brutal-sm p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`font-display text-sm font-bold ${
                              match.result === "victory" ? "text-neon-green text-glow-green" : match.result === "defeat" ? "text-neon-magenta" : "text-neon-cyan"
                            }`}
                          >
                            {match.result.toUpperCase()}
                          </div>
                          <div className="text-[9px] font-mono text-muted-foreground uppercase">{match.mode}</div>
                        </div>
                        <div className="text-[9px] font-mono text-muted-foreground">
                          {new Date(match.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-center">
                        <div>
                          <div className="font-display text-lg text-neon-magenta">{match.playerKills}</div>
                          <div className="text-[8px] font-mono text-muted-foreground">KILLS</div>
                        </div>
                        <div>
                          <div className="font-display text-lg text-neon-green">+{match.tokensEarned}</div>
                          <div className="text-[8px] font-mono text-muted-foreground">EARNED</div>
                        </div>
                        <div>
                          <div className="font-display text-lg text-neon-amber">-{match.tokensSpent}</div>
                          <div className="text-[8px] font-mono text-muted-foreground">SPENT</div>
                        </div>
                        <div>
                          <div className={`font-display text-lg ${match.tokenNet >= 0 ? "text-neon-green" : "text-neon-magenta"}`}>
                            {match.tokenNet >= 0 ? "+" : ""}{match.tokenNet}
                          </div>
                          <div className="text-[8px] font-mono text-muted-foreground">NET</div>
                        </div>
                        <div>
                          <div className="font-mono text-sm text-neon-cyan">{match.duration}s</div>
                          <div className="text-[8px] font-mono text-muted-foreground">DURATION</div>
                        </div>
                      </div>
                      {match.weaponUsed && (
                        <div className="mt-2 pt-2 border-t border-border/20 text-[9px] font-mono text-muted-foreground">
                          Weapon: {match.weaponUsed} · Player: {match.playerName}
                          {match.skyboxPrompt && ` · Arena: ${match.skyboxPrompt.slice(0, 50)}...`}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

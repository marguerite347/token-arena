/*
 * GameHUD — Neon Brutalism HUD overlay
 * Design: Translucent angular panels with neon borders, glitch animations
 * Typography: Orbitron for numbers, JetBrains Mono for data, Space Grotesk for labels
 */
import { useGame } from "@/contexts/GameContext";
import { motion, AnimatePresence } from "framer-motion";

export default function GameHUD() {
  const { state } = useGame();
  const { player, agents, matchTime, matchDuration, combatLog, mode } = state;

  const timeLeft = Math.max(0, matchDuration - matchTime);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  const aliveCount = agents.filter((a) => a.isAlive).length;

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline-overlay opacity-30" />

      {/* Top bar — Match info */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2">
        {/* Timer */}
        <div className="hud-panel clip-brutal-sm px-4 py-2 animate-slide-left">
          <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-neon-cyan/70">Match Time</div>
          <div className="font-display text-2xl text-neon-cyan text-glow-cyan tabular-nums">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        </div>

        {/* Round & Mode */}
        <div className="hud-panel clip-brutal-sm px-6 py-2">
          <div className="text-center">
            <div className="font-display text-sm text-neon-magenta text-glow-magenta uppercase tracking-widest">
              {mode === "pvai" ? "PLAYER vs AI" : "AI vs AI"}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              ROUND {state.round} — {aliveCount} AGENTS ALIVE
            </div>
          </div>
        </div>

        {/* Kills */}
        <div className="hud-panel clip-brutal-sm px-4 py-2 animate-slide-right">
          <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-neon-magenta/70">Eliminations</div>
          <div className="font-display text-2xl text-neon-magenta text-glow-magenta tabular-nums text-right">
            {player.kills}
          </div>
        </div>
      </div>

      {/* Left panel — Player stats */}
      {mode === "pvai" && (
        <div className="absolute bottom-4 left-4 animate-slide-left">
          <div className="hud-panel clip-brutal px-4 py-3 w-64">
            {/* Health */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60">Hull Integrity</span>
                <span className="font-mono text-xs text-neon-green text-glow-green">{player.health}/{player.maxHealth}</span>
              </div>
              <div className="h-2 bg-background/50 clip-brutal-sm overflow-hidden">
                <motion.div
                  className="h-full"
                  style={{
                    width: `${(player.health / player.maxHealth) * 100}%`,
                    backgroundColor: player.health > 50 ? "#39FF14" : player.health > 25 ? "#FFB800" : "#FF3333",
                    boxShadow: `0 0 8px ${player.health > 50 ? "#39FF14" : player.health > 25 ? "#FFB800" : "#FF3333"}`,
                  }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </div>

            {/* Tokens */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60">Token Balance</span>
                <span className="font-display text-lg text-neon-green text-glow-green tabular-nums">{player.tokens}</span>
              </div>
              <div className="flex gap-2 text-[9px] font-mono text-muted-foreground">
                <span className="text-neon-green">+{state.tokensEarned} earned</span>
                <span className="text-neon-magenta">-{state.tokensSpent} spent</span>
              </div>
            </div>

            {/* Weapon */}
            <div className="border-t border-border/30 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60">Weapon</div>
                  <div className="font-mono text-sm" style={{ color: player.weapon.color }}>
                    {player.weapon.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-mono text-muted-foreground">COST/SHOT</div>
                  <div className="font-display text-sm text-neon-amber">{player.weapon.tokenCost} TKN</div>
                </div>
              </div>
            </div>

            {/* Armor */}
            {player.armorValue > 0 && (
              <div className="border-t border-border/30 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60">Armor</span>
                  <span className="font-mono text-xs text-neon-cyan">{player.armorValue}% DR</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right panel — Agent list */}
      <div className="absolute top-20 right-4 animate-slide-right">
        <div className="hud-panel clip-brutal-sm px-3 py-2 w-52">
          <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60 mb-2">Combatants</div>
          <div className="space-y-1">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={`flex items-center justify-between text-xs font-mono ${!agent.isAlive ? "opacity-30 line-through" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2" style={{ backgroundColor: agent.color, boxShadow: `0 0 4px ${agent.color}` }} />
                  <span className="text-foreground/80">{agent.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neon-green text-[10px]">{agent.health}</span>
                  <span className="text-neon-amber text-[10px]">{agent.tokens}T</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom center — Crosshair */}
      {mode === "pvai" && state.phase === "combat" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-8 h-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-neon-cyan/80" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-neon-cyan/80" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-neon-cyan/80" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-neon-cyan/80" />
            <div className="absolute inset-[12px] border border-neon-cyan/40" />
          </div>
        </div>
      )}

      {/* Combat log */}
      <div className="absolute bottom-4 right-4 w-72">
        <div className="hud-panel clip-brutal-sm px-3 py-2 max-h-40 overflow-hidden">
          <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60 mb-1">Combat Log</div>
          <AnimatePresence mode="popLayout">
            {combatLog.slice(-6).map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className={`text-[10px] font-mono leading-relaxed ${
                  log.type === "kill"
                    ? "text-neon-magenta"
                    : log.type === "damage"
                      ? "text-neon-amber"
                      : log.type === "token"
                        ? "text-neon-green"
                        : log.type === "shop"
                          ? "text-neon-cyan"
                          : "text-muted-foreground"
                }`}
              >
                {log.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls hint */}
      {mode === "pvai" && state.phase === "combat" && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <div className="text-[9px] font-mono text-muted-foreground/50 text-center">
            WASD move · Mouse aim · Click fire · ESC pause
          </div>
        </div>
      )}
    </div>
  );
}

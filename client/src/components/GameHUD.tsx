/*
 * GameHUD — Neon Brutalism HUD overlay with Web3 integration
 * Shows wallet status, x402 transaction feed, agent identity badges
 */
import { useGame } from "@/contexts/GameContext";
import { useWallet } from "@/contexts/WalletContext";
import WalletButton from "@/components/WalletButton";
import X402TransactionFeed from "@/components/X402TransactionFeed";
import { motion, AnimatePresence } from "framer-motion";
import { WEAPON_TOKENS } from "@shared/web3";

export default function GameHUD() {
  const { state } = useGame();
  const wallet = useWallet();
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

        {/* Wallet + Kills */}
        <div className="flex items-center gap-2 animate-slide-right">
          <div className="pointer-events-auto">
            <WalletButton compact />
          </div>
          <div className="hud-panel clip-brutal-sm px-4 py-2">
            <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-neon-magenta/70">Eliminations</div>
            <div className="font-display text-2xl text-neon-magenta text-glow-magenta tabular-nums text-right">
              {player.kills}
            </div>
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

            {/* On-chain Token Balances */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60">Token Balance</span>
                <span className="font-display text-lg text-neon-green text-glow-green tabular-nums">{player.tokens}</span>
              </div>
              {/* Per-weapon token balances from wallet */}
              <div className="grid grid-cols-3 gap-1 mb-1">
                {wallet.tokenBalances.filter(t => t.symbol !== "ARENA").map((t) => (
                  <div key={t.symbol} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5" style={{ backgroundColor: t.color }} />
                    <span className="font-mono text-[8px]" style={{ color: t.color }}>{t.balance}</span>
                    <span className="font-mono text-[7px] text-muted-foreground/50">{t.symbol}</span>
                  </div>
                ))}
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

            {/* x402 indicator */}
            <div className="border-t border-border/30 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[8px] px-1.5 py-0.5 bg-neon-green/10 text-neon-green border border-neon-green/20">x402</span>
                  <span className="font-mono text-[8px] px-1.5 py-0.5 bg-neon-cyan/10 text-neon-cyan/70 border border-neon-cyan/10">Base L2</span>
                </div>
                <span className="font-mono text-[8px] text-neon-green">
                  {wallet.isConnected ? "● ON-CHAIN" : "○ SIMULATED"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right panel — Agent list with ERC-8004 badges */}
      <div className="absolute top-20 right-4 animate-slide-right">
        <div className="hud-panel clip-brutal-sm px-3 py-2 w-56">
          <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-foreground/60 mb-2">
            Combatants <span className="text-neon-cyan/50 text-[8px]">ERC-8004</span>
          </div>
          <div className="space-y-1">
            {agents.map((agent, idx) => {
              const weaponToken = WEAPON_TOKENS[agent.weapon.type];
              return (
                <div
                  key={agent.id}
                  className={`flex items-center justify-between text-xs font-mono ${!agent.isAlive ? "opacity-30 line-through" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2" style={{ backgroundColor: agent.color, boxShadow: `0 0 4px ${agent.color}` }} />
                    <span className="text-foreground/80">{agent.name}</span>
                    <span className="text-[7px] text-neon-cyan/40">#{idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neon-green text-[10px]">{agent.health}</span>
                    <span className="text-[10px]" style={{ color: weaponToken?.color ?? "#FFB800" }}>{agent.tokens}T</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* x402 Transaction Feed (bottom-left, above player stats in spectator mode) */}
      <div className={`absolute ${mode === "pvai" ? "bottom-52 left-4" : "bottom-4 left-4"} w-72`}>
        <X402TransactionFeed compact maxItems={5} />
      </div>

      {/* Weapon switch hint */}
      {mode === "pvai" && state.phase === "combat" && (
        <div className="absolute bottom-16 left-4">
          <div className="flex gap-1">
            {["1", "2", "3", "4", "5", "6"].map((key, i) => {
              const weaponTypes = ["plasma", "railgun", "scatter", "missile", "beam", "nova"];
              const isActive = player.weapon.type === weaponTypes[i];
              return (
                <div
                  key={key}
                  className={`w-6 h-6 flex items-center justify-center text-[9px] font-mono border ${
                    isActive
                      ? "border-neon-cyan/80 text-neon-cyan bg-neon-cyan/10"
                      : "border-border/30 text-muted-foreground/40"
                  }`}
                >
                  {key}
                </div>
              );
            })}
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
            WASD move · Mouse aim · Click fire · ESC pause · 1-6 weapons
          </div>
        </div>
      )}
    </div>
  );
}

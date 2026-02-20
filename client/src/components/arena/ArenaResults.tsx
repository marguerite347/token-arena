/**
 * ArenaResults — Post-match results screen with token tally, on-chain receipt, and replay button
 */
import { useGame } from "@/contexts/GameContext";
import { useWallet } from "@/contexts/WalletContext";
import { useLocation } from "wouter";
import { ARENA_PROMPTS } from "@/lib/skyboxApi";
import { motion } from "framer-motion";
import type { ReplayData } from "@/lib/replayEngine";

interface ArenaResultsProps {
  activeReplay: ReplayData | null;
  saveMatchSuccess: boolean;
  onClose: () => void;
  onWatchReplay: () => void;
  onNextMatch: () => void;
}

export default function ArenaResults({
  activeReplay,
  saveMatchSuccess,
  onClose,
  onWatchReplay,
  onNextMatch,
}: ArenaResultsProps) {
  const { state, dispatch } = useGame();
  const wallet = useWallet();
  const [, navigate] = useLocation();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="max-w-lg w-full mx-4"
      >
        <div className="hud-panel clip-brutal p-6 text-center">
          <div
            className={`font-display text-5xl font-black mb-4 ${
              state.phase === "victory" ? "text-neon-green text-glow-green" : "text-neon-magenta text-glow-magenta"
            }`}
          >
            {state.phase === "victory" ? "VICTORY" : "DEFEATED"}
          </div>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <div>
              <div className="font-display text-2xl text-neon-cyan">{state.player.kills}</div>
              <div className="text-[9px] font-mono text-muted-foreground">ELIMINATIONS</div>
            </div>
            <div>
              <div className="font-display text-2xl text-neon-green">+{state.tokensEarned}</div>
              <div className="text-[9px] font-mono text-muted-foreground">EARNED</div>
            </div>
            <div>
              <div className="font-display text-2xl text-neon-amber">-{state.tokensSpent}</div>
              <div className="text-[9px] font-mono text-muted-foreground">SPENT</div>
            </div>
            <div>
              <div className={`font-display text-2xl ${state.tokensEarned - state.tokensSpent >= 0 ? "text-neon-green" : "text-neon-magenta"}`}>
                {state.tokensEarned - state.tokensSpent >= 0 ? "+" : ""}{state.tokensEarned - state.tokensSpent}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground">NET</div>
            </div>
          </div>

          {/* On-chain receipt */}
          <div className="bg-background/50 clip-brutal-sm p-3 mb-4 text-left">
            <div className="text-[9px] font-mono text-neon-cyan/70 mb-1">ON-CHAIN SETTLEMENT (Base Sepolia L2)</div>
            <div className="text-[9px] font-mono text-muted-foreground space-y-0.5">
              <div>wallet: {wallet.address ? `${wallet.address.slice(0, 10)}...${wallet.address.slice(-6)}` : "simulated (no wallet connected)"}</div>
              <div>tokens_in: {state.tokensEarned} TKN · tokens_out: {state.tokensSpent} TKN</div>
              <div>net: {state.tokensEarned - state.tokensSpent > 0 ? "+" : ""}{state.tokensEarned - state.tokensSpent} TKN</div>
              <div>x402_txns: {wallet.completedPayments.length} · protocol: x402 · chain: base-sepolia</div>
              <div>agent_id: {state.player.erc8004Id} (ERC-8004)</div>
            </div>
          </div>

          {/* Wallet token summary */}
          <div className="bg-background/50 clip-brutal-sm p-3 mb-4">
            <div className="text-[9px] font-mono text-neon-green/70 mb-1">TOKEN BALANCES AFTER MATCH</div>
            <div className="grid grid-cols-3 gap-2">
              {wallet.tokenBalances.filter(t => t.symbol !== "ARENA").map((t) => (
                <div key={t.symbol} className="flex items-center gap-1">
                  <div className="w-2 h-2" style={{ backgroundColor: t.color }} />
                  <span className="font-mono text-[10px]" style={{ color: t.color }}>{t.balance}</span>
                  <span className="font-mono text-[8px] text-muted-foreground/50">{t.symbol}</span>
                </div>
              ))}
            </div>
          </div>

          {saveMatchSuccess && (
            <div className="text-[9px] font-mono text-neon-green/70 mb-3">Match saved to leaderboard</div>
          )}

          {/* Watch Replay button */}
          {activeReplay && (
            <div className="mb-4">
              <button
                onClick={onWatchReplay}
                className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-xs text-blue-400 hover:bg-blue-400/10 transition-colors pointer-events-auto w-full"
              >
                📹 WATCH REPLAY ({activeReplay.highlights.length} highlights)
              </button>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={onNextMatch}
              className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-cyan hover:bg-neon-cyan/10 transition-colors pointer-events-auto"
            >
              NEXT MATCH
            </button>
            <button
              onClick={() => { onClose(); dispatch({ type: "RESET_MATCH" }); navigate("/shop"); }}
              className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-green hover:bg-neon-green/10 transition-colors pointer-events-auto"
            >
              ARMORY
            </button>
            <button
              onClick={() => { onClose(); dispatch({ type: "RESET_MATCH" }); navigate("/leaderboard"); }}
              className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-amber hover:bg-neon-amber/10 transition-colors pointer-events-auto"
            >
              RANKINGS
            </button>
            <button
              onClick={() => { onClose(); dispatch({ type: "RESET_MATCH" }); navigate("/"); }}
              className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
            >
              LOBBY
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * ArenaCombatOverlays — Hit flash, crosshair, countdown, and pause overlays
 */
import { useGame } from "@/contexts/GameContext";
import { motion, AnimatePresence } from "framer-motion";
import GameHUD from "@/components/GameHUD";
import PredictionTicker from "@/components/PredictionTicker";

interface ArenaCombatOverlaysProps {
  hitFlash: boolean;
  countdown: number;
}

export default function ArenaCombatOverlays({ hitFlash, countdown }: ArenaCombatOverlaysProps) {
  const { state, dispatch } = useGame();

  return (
    <>
      {/* Hit flash overlay */}
      <AnimatePresence>
        {hitFlash && (
          <motion.div
            className="fixed inset-0 z-30 pointer-events-none bg-neon-magenta/20"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>

      {/* Crosshair (PvAI combat only) */}
      {state.phase === "combat" && state.mode === "pvai" && state.player.isAlive && (
        <div className="fixed inset-0 z-20 pointer-events-none flex items-center justify-center">
          <div className="relative w-8 h-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-neon-cyan/80" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-neon-cyan/80" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2.5 h-0.5 bg-neon-cyan/80" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-0.5 bg-neon-cyan/80" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-neon-cyan/60" />
          </div>
        </div>
      )}

      {/* HUD Overlay (only during combat) */}
      {(state.phase === "combat" || state.phase === "countdown") && <GameHUD />}

      {/* Bloomberg-style Prediction Ticker during combat */}
      <PredictionTicker />

      {/* Countdown Overlay */}
      <AnimatePresence>
        {state.phase === "countdown" && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="font-display text-[120px] font-black text-neon-cyan text-glow-cyan"
            >
              {countdown > 0 ? countdown : "FIGHT"}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause overlay */}
      {state.isPaused && state.phase === "combat" && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80">
          <div className="hud-panel clip-brutal p-8 text-center">
            <div className="font-display text-3xl text-neon-amber text-glow-green mb-4">PAUSED</div>
            <div className="text-xs font-mono text-muted-foreground mb-4">Press ESC to resume</div>
            <button
              onClick={() => dispatch({ type: "SET_PAUSED", paused: false })}
              className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-cyan hover:bg-neon-cyan/10 transition-colors pointer-events-auto"
            >
              RESUME
            </button>
          </div>
        </div>
      )}
    </>
  );
}

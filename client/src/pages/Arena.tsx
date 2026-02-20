/*
 * Arena Page — Main game screen with Three.js canvas and HUD overlay
 * Design: Neon Brutalism — full-bleed immersive canvas, HUD panels float over skybox
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/contexts/GameContext";
import { useGameEngine } from "@/hooks/useGameEngine";
import GameHUD from "@/components/GameHUD";
import { generateSkybox, pollSkyboxUntilComplete, getSkyboxStyles, ARENA_PROMPTS } from "@/lib/skyboxApi";
import { motion, AnimatePresence } from "framer-motion";

export default function Arena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch, startMatch } = useGame();
  const [, navigate] = useLocation();
  const [skyboxLoading, setSkyboxLoading] = useState(false);
  const [skyboxProgress, setSkyboxProgress] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [showResults, setShowResults] = useState(false);

  useGameEngine({ canvasRef });

  // Load skybox styles on mount
  useEffect(() => {
    getSkyboxStyles()
      .then((styles) => {
        dispatch({
          type: "SET_SKYBOX_STYLES",
          styles: styles.map((s) => ({ id: s.id, name: s.name })),
        });
      })
      .catch(console.error);
  }, [dispatch]);

  // Generate skybox environment
  const handleGenerateSkybox = useCallback(
    async (prompt?: string, styleId?: number) => {
      setSkyboxLoading(true);
      setSkyboxProgress("Initiating skybox generation...");
      dispatch({ type: "SET_SKYBOX", skybox: { status: "generating" } });

      try {
        const p = prompt || state.skyboxPrompt;
        const s = styleId || state.selectedSkyboxStyle;
        const result = await generateSkybox(p, s, true);
        setSkyboxProgress(`Status: ${result.status}... Waiting for AI generation`);

        const completed = await pollSkyboxUntilComplete(result.id, (status) => {
          setSkyboxProgress(`Status: ${status}...`);
        });

        dispatch({
          type: "SET_SKYBOX",
          skybox: {
            id: completed.id,
            status: "ready",
            imageUrl: completed.file_url,
            thumbUrl: completed.thumb_url,
            depthMapUrl: completed.depth_map_url,
            prompt: p,
            styleName: completed.title,
          },
        });
        setSkyboxProgress("Skybox ready!");
      } catch (err) {
        console.error("Skybox generation failed:", err);
        dispatch({ type: "SET_SKYBOX", skybox: { status: "error" } });
        setSkyboxProgress("Generation failed. Using default environment.");
      } finally {
        setSkyboxLoading(false);
      }
    },
    [dispatch, state.skyboxPrompt, state.selectedSkyboxStyle]
  );

  // Countdown timer
  useEffect(() => {
    if (state.phase !== "countdown") return;
    setCountdown(3);
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        setCountdown(0);
        setTimeout(() => dispatch({ type: "SET_PHASE", phase: "combat" }), 100);
      } else {
        setCountdown(count);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.phase, dispatch]);

  // Show results screen
  useEffect(() => {
    if (state.phase === "victory" || state.phase === "defeat") {
      setShowResults(true);
    }
  }, [state.phase]);

  const handleStartPvAI = () => {
    startMatch("pvai", 4);
  };

  const handleStartAIvAI = () => {
    startMatch("aivai", 6);
  };

  const handleQuickArena = (idx: number) => {
    const arena = ARENA_PROMPTS[idx];
    handleGenerateSkybox(arena.prompt, arena.styleId);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} id="game-canvas" className="absolute inset-0" />

      {/* HUD Overlay (only during combat) */}
      {(state.phase === "combat" || state.phase === "countdown") && <GameHUD />}

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

      {/* Pre-match Setup */}
      {state.phase === "menu" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/90" />
          <div className="relative z-10 max-w-2xl w-full mx-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
              {/* Title */}
              <div className="text-center mb-8">
                <h1 className="font-display text-4xl md:text-5xl font-black text-neon-cyan text-glow-cyan tracking-wider mb-2">
                  TOKEN ARENA
                </h1>
                <p className="font-mono text-sm text-muted-foreground">
                  AI Agent Battle Arena — On-Chain Token Combat
                </p>
              </div>

              {/* Skybox Generation */}
              <div className="hud-panel clip-brutal p-4 mb-4">
                <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-neon-cyan/70 mb-3">
                  Environment — Powered by Skybox AI
                </div>

                {/* Quick arena presets */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {ARENA_PROMPTS.map((arena, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuickArena(i)}
                      disabled={skyboxLoading}
                      className="hud-panel clip-brutal-sm px-2 py-2 text-[9px] font-mono text-foreground/70 hover:text-neon-cyan hover:border-neon-cyan/50 transition-colors pointer-events-auto text-center disabled:opacity-50"
                    >
                      {arena.name}
                    </button>
                  ))}
                </div>

                {/* Custom prompt */}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={state.skyboxPrompt}
                    onChange={(e) => dispatch({ type: "SET_SKYBOX_PROMPT", prompt: e.target.value })}
                    placeholder="Describe your arena environment..."
                    className="flex-1 bg-background/50 border border-border/50 clip-brutal-sm px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:border-neon-cyan/50 focus:outline-none pointer-events-auto"
                  />
                  <button
                    onClick={() => handleGenerateSkybox()}
                    disabled={skyboxLoading}
                    className="hud-panel clip-brutal-sm px-4 py-2 font-mono text-xs text-neon-cyan hover:bg-neon-cyan/10 transition-colors pointer-events-auto disabled:opacity-50"
                  >
                    {skyboxLoading ? "GENERATING..." : "GENERATE"}
                  </button>
                </div>

                {/* Style selector */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono text-muted-foreground">Style:</span>
                  <select
                    value={state.selectedSkyboxStyle}
                    onChange={(e) => dispatch({ type: "SET_SKYBOX_STYLE", styleId: Number(e.target.value) })}
                    className="bg-background/50 border border-border/50 px-2 py-1 text-[10px] font-mono text-foreground pointer-events-auto"
                  >
                    {state.skyboxStyles.length > 0
                      ? state.skyboxStyles.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))
                      : ARENA_PROMPTS.map((a, i) => (
                          <option key={i} value={a.styleId}>
                            {a.name}
                          </option>
                        ))}
                  </select>
                </div>

                {/* Progress */}
                {skyboxProgress && (
                  <div className="text-[10px] font-mono text-neon-cyan/70 animate-pulse-neon">{skyboxProgress}</div>
                )}
                {state.skybox.status === "ready" && (
                  <div className="text-[10px] font-mono text-neon-green">
                    ✓ Environment loaded: {state.skybox.styleName}
                  </div>
                )}
              </div>

              {/* Game Mode Selection */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  onClick={handleStartPvAI}
                  className="hud-panel clip-brutal p-4 text-left hover:border-neon-cyan/50 hover:neon-glow-cyan transition-all pointer-events-auto group"
                >
                  <div className="font-display text-lg text-neon-cyan text-glow-cyan mb-1 group-hover:animate-glitch">
                    PLAYER vs AI
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    Battle 4 AI agents in first-person combat. Spend tokens to fire, collect tokens from hits. Survive to keep your earnings.
                  </div>
                  <div className="mt-2 text-[9px] font-mono text-neon-green">WASD + Mouse · Click to fire</div>
                </button>

                <button
                  onClick={handleStartAIvAI}
                  className="hud-panel clip-brutal p-4 text-left hover:border-neon-magenta/50 hover:neon-glow-magenta transition-all pointer-events-auto group"
                >
                  <div className="font-display text-lg text-neon-magenta text-glow-magenta mb-1 group-hover:animate-glitch">
                    AI vs AI
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    Spectate 6 autonomous AI agents battling for token supremacy. Watch emergent strategies unfold in real-time.
                  </div>
                  <div className="mt-2 text-[9px] font-mono text-neon-amber">Spectator mode · Auto-camera</div>
                </button>
              </div>

              {/* Token Economy Info */}
              <div className="hud-panel clip-brutal-sm p-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="font-display text-lg text-neon-green text-glow-green">{state.player.tokens}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">TOKEN BALANCE</div>
                  </div>
                  <div>
                    <div className="font-display text-lg text-neon-cyan">{state.player.weapon.name.split(" ")[0]}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">EQUIPPED WEAPON</div>
                  </div>
                  <div>
                    <button
                      onClick={() => navigate("/shop")}
                      className="font-display text-lg text-neon-amber hover:text-glow-green transition-all pointer-events-auto"
                    >
                      ARMORY →
                    </button>
                    <div className="text-[9px] font-mono text-muted-foreground">SHOP & UPGRADES</div>
                  </div>
                </div>
              </div>

              {/* Back to home */}
              <div className="text-center mt-4">
                <button
                  onClick={() => navigate("/")}
                  className="text-[10px] font-mono text-muted-foreground hover:text-neon-cyan transition-colors pointer-events-auto"
                >
                  ← BACK TO LOBBY
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Results Screen */}
      <AnimatePresence>
        {showResults && (state.phase === "victory" || state.phase === "defeat") && (
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

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <div className="font-display text-2xl text-neon-cyan">{state.player.kills}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">ELIMINATIONS</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl text-neon-green">{state.player.tokens}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">TOKENS KEPT</div>
                  </div>
                  <div>
                    <div className="font-display text-2xl text-neon-amber">{state.tokensEarned}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">TOKENS EARNED</div>
                  </div>
                </div>

                {/* On-chain receipt mock */}
                <div className="bg-background/50 clip-brutal-sm p-3 mb-4 text-left">
                  <div className="text-[9px] font-mono text-neon-cyan/70 mb-1">ON-CHAIN SETTLEMENT (Base L2)</div>
                  <div className="text-[9px] font-mono text-muted-foreground space-y-0.5">
                    <div>tx: 0x{Math.random().toString(16).slice(2, 18)}...{Math.random().toString(16).slice(2, 6)}</div>
                    <div>tokens_in: {state.tokensEarned} TKN</div>
                    <div>tokens_out: {state.tokensSpent} TKN</div>
                    <div>net: {state.tokensEarned - state.tokensSpent > 0 ? "+" : ""}{state.tokensEarned - state.tokensSpent} TKN</div>
                    <div>agent_id: {state.player.erc8004Id} (ERC-8004)</div>
                    <div>x402_payment: verified ✓</div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setShowResults(false);
                      dispatch({ type: "RESET_MATCH" });
                    }}
                    className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-cyan hover:bg-neon-cyan/10 transition-colors pointer-events-auto"
                  >
                    PLAY AGAIN
                  </button>
                  <button
                    onClick={() => {
                      setShowResults(false);
                      dispatch({ type: "RESET_MATCH" });
                      navigate("/shop");
                    }}
                    className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-green hover:bg-neon-green/10 transition-colors pointer-events-auto"
                  >
                    ARMORY
                  </button>
                  <button
                    onClick={() => {
                      setShowResults(false);
                      dispatch({ type: "RESET_MATCH" });
                      navigate("/");
                    }}
                    className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
                  >
                    LOBBY
                  </button>
                </div>
              </div>
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
    </div>
  );
}

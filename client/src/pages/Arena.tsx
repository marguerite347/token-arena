/*
 * Arena Page — Main game screen with Three.js canvas, HUD, and Web3 wallet integration
 * Uses tRPC for Skybox API proxy, saves match results + x402 transactions to DB
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/contexts/GameContext";
import { useWallet } from "@/contexts/WalletContext";
import { useGameEngine } from "@/hooks/useGameEngine";
import GameHUD from "@/components/GameHUD";
import AgentIdentityCard from "@/components/AgentIdentityCard";
import WalletButton from "@/components/WalletButton";
import { ARENA_PROMPTS } from "@/lib/skyboxApi";
import { soundEngine } from "@/lib/soundEngine";
import { trpc } from "@/lib/trpc";
import { DEFAULT_AI_AGENTS, WEAPON_TOKENS } from "@shared/web3";
import { motion, AnimatePresence } from "framer-motion";
import CraftingPanel from "@/components/CraftingPanel";
import AgentBrainPanel from "@/components/AgentBrainPanel";
import GameMasterPanel from "@/components/GameMasterPanel";

export default function Arena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch, startMatch } = useGame();
  const wallet = useWallet();
  const [, navigate] = useLocation();
  const [skyboxLoading, setSkyboxLoading] = useState(false);
  const [skyboxProgress, setSkyboxProgress] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [showResults, setShowResults] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [showCrafting, setShowCrafting] = useState(false);
  const [showBrain, setShowBrain] = useState(false);
  const [showGameMaster, setShowGameMaster] = useState(false);
  const prevHealthRef = useRef(state.player.health);
  const prevPhaseRef = useRef(state.phase);
  const matchSavedRef = useRef(false);

  useGameEngine({ canvasRef });

  // tRPC mutations
  const generateSkyboxMut = trpc.skybox.generate.useMutation();
  const saveMatchMut = trpc.match.save.useMutation();
  const logX402Mut = trpc.x402.log.useMutation();
  const craftingInitMut = trpc.crafting.init.useMutation();
  const rollDropsMut = trpc.crafting.rollDrops.useMutation();

  // Seed crafting materials/recipes on first load
  const craftingSeeded = useRef(false);
  useEffect(() => {
    if (!craftingSeeded.current) {
      craftingSeeded.current = true;
      craftingInitMut.mutate();
    }
  }, []);

  // Initialize sound engine on first interaction
  useEffect(() => {
    const initSound = () => {
      soundEngine.init();
      window.removeEventListener("click", initSound);
      window.removeEventListener("keydown", initSound);
    };
    window.addEventListener("click", initSound);
    window.addEventListener("keydown", initSound);
    return () => {
      window.removeEventListener("click", initSound);
      window.removeEventListener("keydown", initSound);
    };
  }, []);

  // Initialize wallet balances when match starts
  useEffect(() => {
    if (state.phase === "countdown") {
      wallet.initMatchBalances(200);
    }
  }, [state.phase]);

  // Wire wallet to shooting — spend tokens on fire
  const prevProjCountRef = useRef(0);
  useEffect(() => {
    if (state.projectiles.length > prevProjCountRef.current && state.phase === "combat") {
      const newProjs = state.projectiles.slice(prevProjCountRef.current);
      const playerProj = newProjs.find(p => p.ownerId === state.player.id);
      if (playerProj) {
        soundEngine.playWeaponFire(playerProj.type);
        // x402 payment: spend tokens for shooting
        const result = wallet.spendTokens(playerProj.type, playerProj.tokenValue);
        if (result.success) {
          logX402Mut.mutate({
            paymentId: `fire-${Date.now()}`,
            txHash: result.txHash,
            action: "fire",
            tokenSymbol: result.settlement.token,
            amount: result.settlement.amount,
            fromAddress: result.settlement.from,
            toAddress: result.settlement.to,
          });
        }
      }
    }
    prevProjCountRef.current = state.projectiles.length;
  }, [state.projectiles.length, state.phase, state.player.id]);

  // Roll material drops on kills
  const prevKillsRef = useRef(state.player.kills);
  useEffect(() => {
    if (state.player.kills > prevKillsRef.current && state.phase === "combat") {
      const streak = state.player.kills;
      rollDropsMut.mutate({ weaponUsed: state.player.weapon.type, killStreak: streak, agentId: 1 });
    }
    prevKillsRef.current = state.player.kills;
  }, [state.player.kills, state.phase]);

  // Wire wallet to getting hit — receive tokens
  useEffect(() => {
    if (state.player.health < prevHealthRef.current && state.phase === "combat") {
      soundEngine.playDamage();
      setHitFlash(true);
      setScreenShake(true);
      setTimeout(() => setHitFlash(false), 150);
      setTimeout(() => setScreenShake(false), 200);

      // x402 payment: receive tokens from incoming fire
      const dmg = prevHealthRef.current - state.player.health;
      const tokenValue = Math.max(1, Math.floor(dmg / 5));
      const result = wallet.receiveTokens("plasma", tokenValue, "0x0000000000000000000000000000000000000001");
      if (result.success) {
        logX402Mut.mutate({
          paymentId: `hit-${Date.now()}`,
          txHash: result.txHash,
          action: "hit_receive",
          tokenSymbol: result.settlement.token,
          amount: result.settlement.amount,
          fromAddress: result.settlement.from,
          toAddress: result.settlement.to,
        });
      }
    }
    prevHealthRef.current = state.player.health;
  }, [state.player.health, state.phase]);

  // Sound effects for phase changes
  useEffect(() => {
    if (state.phase === "combat" && prevPhaseRef.current === "countdown") {
      soundEngine.playMatchStart();
      soundEngine.startAmbient();
    }
    if (state.phase === "victory" && prevPhaseRef.current === "combat") {
      soundEngine.playVictory();
      soundEngine.stopAmbient();
    }
    if (state.phase === "defeat" && prevPhaseRef.current === "combat") {
      soundEngine.playDefeat();
      soundEngine.stopAmbient();
    }
    if (state.phase === "menu") {
      soundEngine.stopAmbient();
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  // Save match results to database with wallet address
  useEffect(() => {
    if ((state.phase === "victory" || state.phase === "defeat") && !matchSavedRef.current) {
      matchSavedRef.current = true;
      saveMatchMut.mutate({
        mode: state.mode,
        duration: Math.floor(state.matchTime),
        skyboxPrompt: state.skybox.prompt || undefined,
        skyboxUrl: state.skybox.imageUrl || undefined,
        playerName: state.player.name || "PLAYER",
        playerKills: state.player.kills,
        playerDeaths: state.player.isAlive ? 0 : 1,
        tokensEarned: state.tokensEarned,
        tokensSpent: state.tokensSpent,
        tokenNet: state.tokensEarned - state.tokensSpent,
        result: state.phase,
        weaponUsed: state.player.weapon.type,
        walletAddress: wallet.address ?? undefined,
        agentData: state.agents.map(a => ({
          name: a.name,
          kills: a.kills,
          alive: a.isAlive,
          tokens: a.tokens,
          weapon: a.weapon.type,
        })),
      });
    }
  }, [state.phase]);

  // Generate skybox via server proxy
  const handleGenerateSkybox = useCallback(
    async (prompt?: string, styleId?: number) => {
      setSkyboxLoading(true);
      setSkyboxProgress("Initiating skybox generation...");
      dispatch({ type: "SET_SKYBOX", skybox: { status: "generating" } });

      try {
        const p = prompt || state.skyboxPrompt;
        const s = styleId || state.selectedSkyboxStyle;

        const result = await generateSkyboxMut.mutateAsync({
          prompt: p,
          styleId: s,
          enhancePrompt: true,
        });

        setSkyboxProgress(`Skybox created (ID: ${result.id}). Waiting for render...`);

        const pollForCompletion = async (skyboxId: number, attempts = 0): Promise<void> => {
          if (attempts > 60) throw new Error("Skybox generation timed out");
          await new Promise(r => setTimeout(r, 3000));

          const res = await fetch(`/api/trpc/skybox.poll?input=${encodeURIComponent(JSON.stringify({ id: skyboxId }))}`);
          const json = await res.json();
          const data = json.result?.data;

          if (!data) {
            setSkyboxProgress(`Polling... attempt ${attempts + 1}`);
            return pollForCompletion(skyboxId, attempts + 1);
          }

          setSkyboxProgress(`Status: ${data.status}...`);

          if (data.status === "complete" && data.fileUrl) {
            dispatch({
              type: "SET_SKYBOX",
              skybox: {
                id: data.id,
                status: "ready",
                imageUrl: data.fileUrl,
                thumbUrl: data.thumbUrl || "",
                depthMapUrl: data.depthMapUrl || "",
                prompt: p,
                styleName: `Skybox #${data.id}`,
              },
            });
            setSkyboxProgress("Skybox ready!");
            return;
          }

          if (data.status === "error") throw new Error("Skybox generation failed");
          return pollForCompletion(skyboxId, attempts + 1);
        };

        await pollForCompletion(result.id);
      } catch (err) {
        console.error("Skybox generation failed:", err);
        dispatch({ type: "SET_SKYBOX", skybox: { status: "error" } });
        setSkyboxProgress("Generation failed. Using default environment.");
      } finally {
        setSkyboxLoading(false);
      }
    },
    [dispatch, state.skyboxPrompt, state.selectedSkyboxStyle, generateSkyboxMut]
  );

  // Load skybox styles from server
  const { data: stylesData } = trpc.skybox.getStyles.useQuery(undefined, { staleTime: 60000 });
  useEffect(() => {
    if (stylesData && stylesData.length > 0) {
      dispatch({
        type: "SET_SKYBOX_STYLES",
        styles: stylesData.map((s) => ({ id: s.id, name: s.name })),
      });
    }
  }, [stylesData, dispatch]);

  // Countdown timer
  useEffect(() => {
    if (state.phase !== "countdown") return;
    setCountdown(3);
    matchSavedRef.current = false;
    let count = 3;
    const interval = setInterval(() => {
      count--;
      soundEngine.playCountdown();
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

  const handleStartPvAI = () => startMatch("pvai", 4);
  const handleStartAIvAI = () => startMatch("aivai", 6);
  const handleQuickArena = (idx: number) => {
    const arena = ARENA_PROMPTS[idx];
    handleGenerateSkybox(arena.prompt, arena.styleId);
  };

  return (
    <div className={`relative w-screen h-screen overflow-hidden bg-background ${screenShake ? "animate-shake" : ""}`}>
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} id="game-canvas" className="absolute inset-0" />

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
        <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto py-8">
          <div className="absolute inset-0 bg-background/90" />
          <div className="relative z-10 max-w-2xl w-full mx-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
              {/* Title + Wallet */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="font-display text-4xl md:text-5xl font-black text-neon-cyan text-glow-cyan tracking-wider">
                    TOKEN ARENA
                  </h1>
                  <p className="font-mono text-sm text-muted-foreground">
                    AI Agent Battle Arena — On-Chain Token Combat
                  </p>
                </div>
                <WalletButton />
              </div>

              {/* Skybox Generation */}
              <div className="hud-panel clip-brutal p-4 mb-4">
                <div className="text-[10px] font-sans uppercase tracking-[0.2em] text-neon-cyan/70 mb-3">
                  Environment — Powered by Skybox AI (Blockade Labs)
                </div>

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

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono text-muted-foreground">Style:</span>
                  <select
                    value={state.selectedSkyboxStyle}
                    onChange={(e) => dispatch({ type: "SET_SKYBOX_STYLE", styleId: Number(e.target.value) })}
                    className="bg-background/50 border border-border/50 px-2 py-1 text-[10px] font-mono text-foreground pointer-events-auto"
                  >
                    {state.skyboxStyles.length > 0
                      ? state.skyboxStyles.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))
                      : ARENA_PROMPTS.map((a, i) => (
                          <option key={i} value={a.styleId}>{a.name}</option>
                        ))}
                  </select>
                </div>

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
                    Battle 4 AI agents. Spend tokens to fire, collect tokens from hits. x402 payments on every shot.
                  </div>
                  <div className="mt-2 text-[9px] font-mono text-neon-green">WASD + Mouse · Click to fire · 1-6 weapons</div>
                </button>

                <button
                  onClick={handleStartAIvAI}
                  className="hud-panel clip-brutal p-4 text-left hover:border-neon-magenta/50 hover:neon-glow-magenta transition-all pointer-events-auto group"
                >
                  <div className="font-display text-lg text-neon-magenta text-glow-magenta mb-1 group-hover:animate-glitch">
                    AI vs AI
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    Spectate 6 autonomous ERC-8004 agents battling for token supremacy. Watch emergent strategies.
                  </div>
                  <div className="mt-2 text-[9px] font-mono text-neon-amber">Spectator mode · Auto-camera</div>
                </button>
              </div>

              {/* Agent Identity Panel Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => setShowAgentPanel(!showAgentPanel)}
                  className="hud-panel clip-brutal-sm px-4 py-2 font-mono text-xs text-neon-cyan/70 hover:text-neon-cyan transition-colors pointer-events-auto w-full text-left"
                >
                  {showAgentPanel ? "▼" : "▶"} ERC-8004 AI AGENT IDENTITIES ({DEFAULT_AI_AGENTS.length} registered)
                </button>
                <AnimatePresence>
                  {showAgentPanel && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {DEFAULT_AI_AGENTS.map((agent) => (
                          <AgentIdentityCard
                            key={agent.agentId}
                            agent={{
                              ...agent,
                              stats: {
                                totalKills: Math.floor(Math.random() * 50),
                                totalDeaths: Math.floor(Math.random() * 30),
                                totalMatches: Math.floor(Math.random() * 20) + 5,
                                totalTokensEarned: Math.floor(Math.random() * 2000),
                                totalTokensSpent: Math.floor(Math.random() * 1500),
                                winRate: 0.3 + Math.random() * 0.5,
                                favoriteWeapon: agent.loadout.primaryWeapon,
                              },
                            }}
                            compact
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Token Economy Info */}
              <div className="hud-panel clip-brutal-sm p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-lg text-neon-green text-glow-green">{wallet.arenaBalance}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">ARENA BALANCE</div>
                  </div>
                  <div>
                    <div className="font-display text-lg text-neon-cyan">{state.player.weapon.name.split(" ")[0]}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">EQUIPPED WEAPON</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[8px] px-1.5 py-0.5 bg-neon-green/10 text-neon-green border border-neon-green/20">x402</span>
                      <span className="font-mono text-[8px] px-1.5 py-0.5 bg-neon-cyan/10 text-neon-cyan/70 border border-neon-cyan/10">Base L2</span>
                    </div>
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

              {/* Advanced Panels */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  onClick={() => setShowCrafting(true)}
                  className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-neon-green hover:bg-neon-green/10 transition-colors pointer-events-auto text-center"
                >
                  ⚒ CRAFTING LAB
                </button>
                <button
                  onClick={() => setShowBrain(true)}
                  className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-purple-400 hover:bg-purple-400/10 transition-colors pointer-events-auto text-center"
                >
                  🧠 AGENT BRAIN
                </button>
                <button
                  onClick={() => setShowGameMaster(true)}
                  className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-neon-amber hover:bg-neon-amber/10 transition-colors pointer-events-auto text-center"
                >
                  🎲 GAME MASTER
                </button>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => navigate("/")}
                  className="text-[10px] font-mono text-muted-foreground hover:text-neon-cyan transition-colors pointer-events-auto"
                >
                  ← LOBBY
                </button>
                <button
                  onClick={() => navigate("/leaderboard")}
                  className="text-[10px] font-mono text-muted-foreground hover:text-neon-amber transition-colors pointer-events-auto"
                >
                  LEADERBOARD →
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

                {/* On-chain receipt with real wallet info */}
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

                {saveMatchMut.isSuccess && (
                  <div className="text-[9px] font-mono text-neon-green/70 mb-3">Match saved to leaderboard</div>
                )}

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => {
                      setShowResults(false);
                      dispatch({ type: "RESET_MATCH" });
                      startMatch(state.mode, state.mode === "pvai" ? 4 : 6);
                    }}
                    className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-cyan hover:bg-neon-cyan/10 transition-colors pointer-events-auto"
                  >
                    PLAY AGAIN
                  </button>
                  <button
                    onClick={() => { setShowResults(false); dispatch({ type: "RESET_MATCH" }); navigate("/shop"); }}
                    className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-green hover:bg-neon-green/10 transition-colors pointer-events-auto"
                  >
                    ARMORY
                  </button>
                  <button
                    onClick={() => { setShowResults(false); dispatch({ type: "RESET_MATCH" }); navigate("/leaderboard"); }}
                    className="hud-panel clip-brutal-sm px-6 py-2 font-mono text-sm text-neon-amber hover:bg-neon-amber/10 transition-colors pointer-events-auto"
                  >
                    RANKINGS
                  </button>
                  <button
                    onClick={() => { setShowResults(false); dispatch({ type: "RESET_MATCH" }); navigate("/"); }}
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

      {/* Crafting Panel */}
      <CraftingPanel agentId={1} isOpen={showCrafting} onClose={() => setShowCrafting(false)} />

      {/* Agent Brain Panel */}
      <AgentBrainPanel isOpen={showBrain} onClose={() => setShowBrain(false)} />

      {/* Game Master Panel */}
      <GameMasterPanel isOpen={showGameMaster} onClose={() => setShowGameMaster(false)} />

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

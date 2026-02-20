/*
 * Arena Page — Main game screen orchestrator
 * Delegates UI to sub-components: ArenaMenu, ArenaResults, ArenaCombatOverlays, ArenaOverlayPanels
 * Keeps game lifecycle hooks, wallet wiring, and skybox generation logic
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { useGame } from "@/contexts/GameContext";
import { useWallet } from "@/contexts/WalletContext";
import { useGameEngine } from "@/hooks/useGameEngine";
import { ARENA_PROMPTS } from "@/lib/skyboxApi";
import { soundEngine } from "@/lib/soundEngine";
import { trpc } from "@/lib/trpc";
import { AnimatePresence } from "framer-motion";
import { startRecording, stopRecording, saveReplay, type ReplayData } from "@/lib/replayEngine";
import type { PersonalityWeights } from "@/components/AgentCustomizer";
import { ArenaMenu, ArenaResults, ArenaCombatOverlays, ArenaOverlayPanels, type PanelState } from "@/components/arena";
import PreGameLobby from "@/components/PreGameLobby";

export default function Arena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch, startMatch } = useGame();
  const wallet = useWallet();

  // UI state
  const [skyboxLoading, setSkyboxLoading] = useState(false);
  const [skyboxProgress, setSkyboxProgress] = useState("");
  const [countdown, setCountdown] = useState(3);
  const [showResults, setShowResults] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [lobbyArenaName, setLobbyArenaName] = useState("");
  const [lobbyMatchMode, setLobbyMatchMode] = useState<"pvai" | "aivai">("pvai");
  const [activeReplay, setActiveReplay] = useState<ReplayData | null>(null);
  const [agentWeights, setAgentWeights] = useState<PersonalityWeights | null>(null);
  const [agentBuildName, setAgentBuildName] = useState("");

  // Panel visibility state
  const [panels, setPanels] = useState<PanelState>({
    crafting: false,
    brain: false,
    gameMaster: false,
    dao: false,
    prediction: false,
    replayViewer: false,
    replayList: false,
    customizer: false,
  });

  // Refs for tracking state changes
  const prevHealthRef = useRef(state.player.health);
  const prevPhaseRef = useRef(state.phase);
  const matchSavedRef = useRef(false);
  const prevProjCountRef = useRef(0);
  const prevKillsRef = useRef(state.player.kills);
  const craftingSeeded = useRef(false);
  const cacheWarmed = useRef(false);

  // Initialize game engine
  useGameEngine({ canvasRef });

  // tRPC mutations
  const generateSkyboxMut = trpc.skybox.generate.useMutation();
  const saveMatchMut = trpc.match.save.useMutation();
  const logX402Mut = trpc.x402.log.useMutation();
  const craftingInitMut = trpc.crafting.init.useMutation();
  const rollDropsMut = trpc.crafting.rollDrops.useMutation();
  const warmCacheMut = trpc.skybox.warmCache.useMutation();
  const generateSceneGraphMut = trpc.skybox.generateSceneGraph.useMutation();

  // ─── Initialization Effects ──────────────────────────────────────────────────

  // Seed crafting materials/recipes on first load
  useEffect(() => {
    if (!craftingSeeded.current) {
      craftingSeeded.current = true;
      craftingInitMut.mutate();
    }
  }, []);

  // Warm skybox cache on first load
  useEffect(() => {
    if (!cacheWarmed.current) {
      cacheWarmed.current = true;
      warmCacheMut.mutate(undefined, {
        onSuccess: (data) => {
          console.log(`[Skybox Cache] Warmed: ${data.alreadyCached} cached, ${data.queued} queued`);
        },
      });
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

  // ─── Wallet & Token Wiring ───────────────────────────────────────────────────

  // Initialize wallet balances when match starts
  useEffect(() => {
    if (state.phase === "countdown") {
      wallet.initMatchBalances(200);
    }
  }, [state.phase]);

  // Wire wallet to shooting — spend tokens on fire
  useEffect(() => {
    if (state.projectiles.length > prevProjCountRef.current && state.phase === "combat") {
      const newProjs = state.projectiles.slice(prevProjCountRef.current);
      const playerProj = newProjs.find(p => p.ownerId === state.player.id);
      if (playerProj) {
        soundEngine.playWeaponFire(playerProj.type);
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
  useEffect(() => {
    if (state.player.kills > prevKillsRef.current && state.phase === "combat") {
      rollDropsMut.mutate({ weaponUsed: state.player.weapon.type, killStreak: state.player.kills, agentId: 1 });
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

  // ─── Phase Lifecycle ─────────────────────────────────────────────────────────

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

  // Save match results to database
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

  // ─── Replay Recording ────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === "countdown") {
      startRecording(state.mode);
    }
  }, [state.phase, state.mode]);

  useEffect(() => {
    if (state.phase === "victory" || state.phase === "defeat") {
      const recorder = stopRecording();
      if (recorder) {
        try {
          const replay = recorder.finalize(
            state.agents,
            state.player,
            state.phase,
            state.skybox.imageUrl,
            state.skybox.prompt,
          );
          saveReplay(replay);
          setActiveReplay(replay);
        } catch (err) {
          console.warn("[Replay] Failed to finalize:", err);
        }
      }
      setShowResults(true);
    }
  }, [state.phase]);

  // ─── Skybox Generation ───────────────────────────────────────────────────────

  const handleGenerateSkybox = useCallback(
    async (prompt?: string, styleId?: number) => {
      setSkyboxLoading(true);
      setSkyboxProgress("Initiating Skybox AI generation...");
      dispatch({ type: "SET_SKYBOX", skybox: { status: "generating" } });

      try {
        const p = prompt || state.skyboxPrompt;
        const s = styleId || state.selectedSkyboxStyle;

        const result = await generateSkyboxMut.mutateAsync({
          prompt: p,
          styleId: s,
          enhancePrompt: true,
        });

        if (!result.id) {
          throw new Error("No skybox ID returned from generation");
        }

        setSkyboxProgress(`Skybox queued (ID: ${result.id}). Rendering 360° environment...`);

        const pollForCompletion = async (skyboxId: number, attempts = 0): Promise<void> => {
          if (attempts > 40) throw new Error("Skybox generation timed out after 2 minutes");
          await new Promise(r => setTimeout(r, 3000));

          const elapsed = (attempts + 1) * 3;
          const progressMessages = [
            "Generating 360° panorama...",
            "AI is painting your arena...",
            "Rendering volumetric lighting...",
            "Applying lighting and atmosphere...",
            "Finalizing equirectangular projection...",
          ];
          const msgIdx = Math.min(Math.floor(elapsed / 8), progressMessages.length - 1);

          try {
            const inputPayload = { json: { id: skyboxId } };
            const res = await fetch(`/api/trpc/skybox.poll?input=${encodeURIComponent(JSON.stringify(inputPayload))}`);
            const json = await res.json();
            const data = json.result?.data?.json || json.result?.data;

            if (!data || !data.status) {
              setSkyboxProgress(`${progressMessages[msgIdx]} (${elapsed}s)`);
              return pollForCompletion(skyboxId, attempts + 1);
            }

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
              setSkyboxProgress(`✓ Environment ready! (${elapsed}s)`);

              // Trigger scene graph generation in background
              if (data.fileUrl) {
                generateSceneGraphMut.mutate(
                  { imageUrl: data.fileUrl, arenaName: p.slice(0, 60) },
                  {
                    onSuccess: (sgResult) => {
                      if (sgResult?.graph) {
                        dispatch({ type: "SET_SCENE_ANALYSIS", analysis: sgResult.agentBriefing || "Scene graph generated" });
                        console.log(`[SceneGraph] Generated: ${sgResult.graph.nodeCount} nodes, ${sgResult.graph.edgeCount} edges`);
                      }
                    },
                    onError: (err) => console.warn("[SceneGraph] Generation failed:", err.message),
                  }
                );
              }
              return;
            }

            if (data.status === "error") throw new Error("Skybox generation failed on server");

            setSkyboxProgress(`${progressMessages[msgIdx]} (${elapsed}s)`);
            return pollForCompletion(skyboxId, attempts + 1);
          } catch (fetchErr: any) {
            console.warn(`[Skybox Poll] Fetch error attempt ${attempts}:`, fetchErr.message);
            setSkyboxProgress(`Reconnecting... (${elapsed}s)`);
            return pollForCompletion(skyboxId, attempts + 1);
          }
        };

        await pollForCompletion(result.id);
      } catch (err: any) {
        console.error("Skybox generation failed:", err);
        dispatch({ type: "SET_SKYBOX", skybox: { status: "error" } });
        setSkyboxProgress(`Generation failed: ${err.message || "Unknown error"}. Using default environment.`);
      } finally {
        setSkyboxLoading(false);
      }
    },
    [dispatch, state.skyboxPrompt, state.selectedSkyboxStyle, generateSkyboxMut]
  );

  // ─── Match Start Handlers ────────────────────────────────────────────────────

  const handleStartPvAI = () => {
    setLobbyMatchMode("pvai");
    setShowLobby(true);
    if (state.skybox.status !== "ready") {
      const randomArena = ARENA_PROMPTS[Math.floor(Math.random() * ARENA_PROMPTS.length)];
      setLobbyArenaName(randomArena.name);
      handleGenerateSkybox(randomArena.prompt, randomArena.styleId);
    } else {
      setLobbyArenaName(state.skybox.styleName || "Custom Arena");
    }
  };

  const handleStartAIvAI = () => {
    setLobbyMatchMode("aivai");
    setShowLobby(true);
    if (state.skybox.status !== "ready") {
      const randomArena = ARENA_PROMPTS[Math.floor(Math.random() * ARENA_PROMPTS.length)];
      setLobbyArenaName(randomArena.name);
      handleGenerateSkybox(randomArena.prompt, randomArena.styleId);
    } else {
      setLobbyArenaName(state.skybox.styleName || "Custom Arena");
    }
  };

  const handleQuickArena = (idx: number) => {
    const arena = ARENA_PROMPTS[idx];
    setLobbyArenaName(arena.name);
    handleGenerateSkybox(arena.prompt, arena.styleId);
  };

  const handleLobbyStartMatch = useCallback((mode: "pvai" | "aivai") => {
    setShowLobby(false);
    startMatch(mode, mode === "pvai" ? 4 : 6);
  }, [startMatch]);

  // ─── Panel Management ────────────────────────────────────────────────────────

  const handleShowPanel = (panel: string) => {
    setPanels(prev => ({ ...prev, [panel]: true }));
  };

  const handleClosePanel = (panel: keyof PanelState) => {
    setPanels(prev => ({ ...prev, [panel]: false }));
    if (panel === "replayViewer") setActiveReplay(null);
  };

  const handleSelectReplay = (replay: ReplayData) => {
    setActiveReplay(replay);
    setPanels(prev => ({ ...prev, replayList: false, replayViewer: true }));
  };

  const handleApplyCustomizer = (weights: PersonalityWeights, name: string) => {
    setAgentWeights(weights);
    setAgentBuildName(name);
    setPanels(prev => ({ ...prev, customizer: false }));
  };

  const handleNextMatch = () => {
    setShowResults(false);
    dispatch({ type: "RESET_MATCH" });
    setLobbyMatchMode(state.mode as "pvai" | "aivai");
    setShowLobby(true);
    const randomArena = ARENA_PROMPTS[Math.floor(Math.random() * ARENA_PROMPTS.length)];
    setLobbyArenaName(randomArena.name);
    handleGenerateSkybox(randomArena.prompt, randomArena.styleId);
  };

  const handleWatchReplay = () => {
    setShowResults(false);
    setPanels(prev => ({ ...prev, replayViewer: true }));
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`relative w-screen h-screen overflow-hidden bg-background ${screenShake ? "animate-shake" : ""}`}>
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} id="game-canvas" className="absolute inset-0" />

      {/* Combat phase overlays: hit flash, crosshair, HUD, countdown, pause */}
      <ArenaCombatOverlays hitFlash={hitFlash} countdown={countdown} />

      {/* Pre-match Menu */}
      {state.phase === "menu" && (
        <ArenaMenu
          skyboxLoading={skyboxLoading}
          skyboxProgress={skyboxProgress}
          onGenerateSkybox={handleGenerateSkybox}
          onStartPvAI={handleStartPvAI}
          onStartAIvAI={handleStartAIvAI}
          onQuickArena={handleQuickArena}
          onShowPanel={handleShowPanel}
        />
      )}

      {/* Results Screen */}
      <AnimatePresence>
        {showResults && (state.phase === "victory" || state.phase === "defeat") && (
          <ArenaResults
            activeReplay={activeReplay}
            saveMatchSuccess={saveMatchMut.isSuccess}
            onClose={() => setShowResults(false)}
            onWatchReplay={handleWatchReplay}
            onNextMatch={handleNextMatch}
          />
        )}
      </AnimatePresence>

      {/* All overlay panels */}
      <ArenaOverlayPanels
        panels={panels}
        activeReplay={activeReplay}
        agentWeights={agentWeights}
        onClosePanel={handleClosePanel}
        onSelectReplay={handleSelectReplay}
        onApplyCustomizer={handleApplyCustomizer}
      />

      {/* Pre-Game Lobby (during skybox generation) */}
      {showLobby && (
        <PreGameLobby
          skyboxReady={state.skybox.status === "ready"}
          skyboxProgress={skyboxProgress}
          onStartMatch={handleLobbyStartMatch}
          onSelectArena={handleQuickArena}
          onCustomArena={(prompt) => handleGenerateSkybox(prompt)}
          matchMode={lobbyMatchMode}
          arenaName={lobbyArenaName}
        />
      )}
    </div>
  );
}

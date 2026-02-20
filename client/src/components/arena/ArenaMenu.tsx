/**
 * ArenaMenu — Pre-match setup screen with skybox generation, mode selection, and panel buttons
 */
import { useGame } from "@/contexts/GameContext";
import { useWallet } from "@/contexts/WalletContext";
import { useLocation } from "wouter";
import { ARENA_PROMPTS } from "@/lib/skyboxApi";
import { DEFAULT_AI_AGENTS } from "@shared/web3";
import { motion, AnimatePresence } from "framer-motion";
import AgentIdentityCard from "@/components/AgentIdentityCard";
import WalletButton from "@/components/WalletButton";
import { useState } from "react";

interface ArenaMenuProps {
  skyboxLoading: boolean;
  skyboxProgress: string;
  onGenerateSkybox: (prompt?: string, styleId?: number) => void;
  onStartPvAI: () => void;
  onStartAIvAI: () => void;
  onQuickArena: (idx: number) => void;
  onShowPanel: (panel: string) => void;
}

export default function ArenaMenu({
  skyboxLoading,
  skyboxProgress,
  onGenerateSkybox,
  onStartPvAI,
  onStartAIvAI,
  onQuickArena,
  onShowPanel,
}: ArenaMenuProps) {
  const { state, dispatch } = useGame();
  const wallet = useWallet();
  const [, navigate] = useLocation();
  const [showAgentPanel, setShowAgentPanel] = useState(false);

  return (
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
                  onClick={() => onQuickArena(i)}
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
                onClick={() => onGenerateSkybox()}
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

            {skyboxLoading && (
              <div className="mt-2 space-y-2">
                <div className="h-1.5 bg-background/50 rounded-full overflow-hidden border border-border/30">
                  <div className="h-full bg-neon-cyan/70 rounded-full animate-pulse" style={{ width: '100%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
                <div className="text-[10px] font-mono text-neon-cyan/70 animate-pulse">{skyboxProgress}</div>
              </div>
            )}
            {!skyboxLoading && skyboxProgress && (
              <div className={`text-[10px] font-mono mt-1 ${skyboxProgress.startsWith('✓') ? 'text-neon-green' : skyboxProgress.includes('failed') ? 'text-red-400' : 'text-neon-cyan/70'}`}>
                {skyboxProgress}
              </div>
            )}
            {state.skybox.status === "ready" && state.skybox.thumbUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={state.skybox.thumbUrl} alt="Skybox preview" className="w-12 h-8 rounded border border-neon-cyan/30 object-cover" />
                <div className="text-[10px] font-mono text-neon-green">
                  ✓ Environment loaded: {state.skybox.styleName}
                </div>
              </div>
            )}
            {state.skybox.status === "ready" && !state.skybox.thumbUrl && (
              <div className="text-[10px] font-mono text-neon-green mt-1">
                ✓ Environment loaded: {state.skybox.styleName}
              </div>
            )}
          </div>

          {/* Game Mode Selection */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={onStartPvAI}
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
              onClick={onStartAIvAI}
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
              onClick={() => onShowPanel("crafting")}
              className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-neon-green hover:bg-neon-green/10 transition-colors pointer-events-auto text-center"
            >
              ⚒ CRAFTING LAB
            </button>
            <button
              onClick={() => onShowPanel("brain")}
              className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-purple-400 hover:bg-purple-400/10 transition-colors pointer-events-auto text-center"
            >
              🧠 AGENT BRAIN
            </button>
            <button
              onClick={() => onShowPanel("gameMaster")}
              className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-neon-amber hover:bg-neon-amber/10 transition-colors pointer-events-auto text-center"
            >
              🎲 GAME MASTER
            </button>
            <button
              onClick={() => onShowPanel("dao")}
              className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-cyan-400 hover:bg-cyan-400/10 transition-colors pointer-events-auto text-center"
            >
              🏛️ DAO COUNCIL
            </button>
            <button
              onClick={() => onShowPanel("prediction")}
              className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-['Orbitron'] text-xs hover:bg-yellow-500/20 transition"
            >
              🎰 PREDICTIONS
            </button>
            <button
              onClick={() => navigate("/tournament")}
              className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-pink-400 hover:bg-pink-400/10 transition-colors pointer-events-auto text-center"
            >
              🏆 TOURNAMENT
            </button>
            <button
              onClick={() => onShowPanel("replayList")}
              className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-blue-400 hover:bg-blue-400/10 transition-colors pointer-events-auto text-center"
            >
              📹 REPLAYS
            </button>
            <button
              onClick={() => onShowPanel("customizer")}
              className="hud-panel clip-brutal-sm px-3 py-2 font-mono text-[10px] text-emerald-400 hover:bg-emerald-400/10 transition-colors pointer-events-auto text-center"
            >
              🎛️ CUSTOMIZE AI
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
  );
}

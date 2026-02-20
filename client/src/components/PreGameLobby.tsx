/**
 * PreGameLobby — Fills the ~30-60s skybox generation wait with meaningful activity
 * 
 * Flow: Match ends → Results → Lobby kicks off skybox gen in background
 * Meanwhile: DAO deliberation, prediction market, shop, arena preview resolving
 * Skybox ready → "ENTERING ARENA" cinematic transition → match begins
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useGame, WEAPONS, SHOP_ITEMS, type WeaponType } from "@/contexts/GameContext";
// Wallet context not needed in lobby
import { motion, AnimatePresence } from "framer-motion";
import { ARENA_PROMPTS } from "@/lib/skyboxApi";

interface PreGameLobbyProps {
  skyboxReady: boolean;
  skyboxProgress: string;
  onStartMatch: (mode: "pvai" | "aivai") => void;
  onSelectArena: (idx: number) => void;
  onCustomArena: (prompt: string) => void;
  matchMode: "pvai" | "aivai";
  arenaName: string;
}

// ─── DAO Deliberation Messages ──────────────────────────────────────────────
const DAO_PHASES = [
  { title: "COUNCIL CONVENING", messages: [
    "Arbiter NEXUS-PRIME reviewing match parameters...",
    "Sentinel VOID-KEEPER scanning arena integrity...",
    "Oracle DATA-WEAVE analyzing agent performance data...",
  ]},
  { title: "DELIBERATION IN PROGRESS", messages: [
    "Proposal: Adjust token distribution curve for next match",
    "Arbiter suggests 15% arena hazard probability increase",
    "Sentinel flags anomalous trading pattern from last round",
    "Oracle predicts 73% chance of aggressive meta shift",
  ]},
  { title: "VOTING PHASE", messages: [
    "NEXUS-PRIME votes: APPROVE modified parameters",
    "VOID-KEEPER votes: APPROVE with amendment",
    "DATA-WEAVE votes: APPROVE — consensus reached",
  ]},
  { title: "RESOLUTION", messages: [
    "DAO Resolution #" + Math.floor(1000 + Math.random() * 9000) + " passed unanimously",
    "New match parameters locked in smart contract",
    "Arena environment calibration complete",
  ]},
];

// ─── Prediction Market Simulation ───────────────────────────────────────────
const BETTORS = [
  "CryptoWhale", "DeFiDegen", "TokenMaxi", "NeonTrader",
  "VoidSpec", "ChainRunner", "BlockBaron", "HashHunter",
];

interface PredictionBet {
  bettor: string;
  agent: string;
  amount: number;
  odds: string;
  timestamp: number;
}

// ─── Agent Names ────────────────────────────────────────────────────────────
const AI_NAMES = ["NEXUS-7", "CIPHER-X", "VORTEX-3", "PHANTOM-9", "STRIKER-1", "ECHO-5"];

export default function PreGameLobby({
  skyboxReady,
  skyboxProgress,
  onStartMatch,
  onSelectArena,
  onCustomArena,
  matchMode,
  arenaName,
}: PreGameLobbyProps) {
  const { state, dispatch } = useGame();

  
  // Lobby state
  const [lobbyPhase, setLobbyPhase] = useState<"dao" | "predictions" | "shop" | "entering">("dao");
  const [daoPhaseIdx, setDaoPhaseIdx] = useState(0);
  const [daoMsgIdx, setDaoMsgIdx] = useState(0);
  const [predictions, setPredictions] = useState<PredictionBet[]>([]);
  const [agentOdds, setAgentOdds] = useState<Map<string, number>>(new Map());
  const [totalPot, setTotalPot] = useState(0);
  const [enteringArena, setEnteringArena] = useState(false);
  const [arenaResolveProgress, setArenaResolveProgress] = useState(0);
  const [selectedTab, setSelectedTab] = useState<"dao" | "predictions" | "shop">("dao");
  const enterTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ─── DAO Deliberation Animation ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setDaoMsgIdx(prev => {
        const phase = DAO_PHASES[daoPhaseIdx];
        if (prev >= phase.messages.length - 1) {
          setDaoPhaseIdx(p => Math.min(p + 1, DAO_PHASES.length - 1));
          return 0;
        }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [daoPhaseIdx]);

  // ─── Prediction Market Simulation ───────────────────────────────────────
  useEffect(() => {
    // Initialize odds
    const names = matchMode === "pvai" ? ["PLAYER", ...AI_NAMES.slice(0, 4)] : AI_NAMES.slice(0, 6);
    const initialOdds = new Map<string, number>();
    names.forEach((name, i) => {
      initialOdds.set(name, 1.5 + Math.random() * 3);
    });
    setAgentOdds(initialOdds);
    setTotalPot(Math.floor(200 + Math.random() * 300));

    // Simulate incoming bets
    const interval = setInterval(() => {
      const bettor = BETTORS[Math.floor(Math.random() * BETTORS.length)];
      const agent = names[Math.floor(Math.random() * names.length)];
      const amount = Math.floor(5 + Math.random() * 50);
      const currentOdds = initialOdds.get(agent) || 2;

      setPredictions(prev => [...prev.slice(-15), {
        bettor,
        agent,
        amount,
        odds: currentOdds.toFixed(1) + ":1",
        timestamp: Date.now(),
      }]);

      setTotalPot(prev => prev + amount);

      // Shift odds slightly
      setAgentOdds(prev => {
        const next = new Map(prev);
        const current = next.get(agent) || 2;
        next.set(agent, Math.max(1.1, current - 0.1)); // More bets = lower odds
        return next;
      });
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [matchMode]);

  // ─── Arena Preview Resolution ───────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setArenaResolveProgress(prev => {
        if (skyboxReady) return 100;
        return Math.min(prev + 1 + Math.random() * 2, 95); // Never reaches 100 until skybox is ready
      });
    }, 500);
    return () => clearInterval(interval);
  }, [skyboxReady]);

  // ─── Skybox Ready → Enter Arena Transition ──────────────────────────────
  useEffect(() => {
    if (skyboxReady && !enteringArena) {
      // Short delay to let player see the arena is ready
      enterTimerRef.current = setTimeout(() => {
        setEnteringArena(true);
        // After cinematic transition, start match
        setTimeout(() => {
          onStartMatch(matchMode);
        }, 3000);
      }, 1500);
    }
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current);
    };
  }, [skyboxReady, enteringArena, matchMode, onStartMatch]);

  // ─── "ENTERING ARENA" Cinematic ─────────────────────────────────────────
  if (enteringArena) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, type: "spring" }}
          >
            <div className="font-display text-6xl md:text-8xl font-black text-neon-cyan text-glow-cyan tracking-widest mb-4">
              ENTERING ARENA
            </div>
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
            className="h-1 bg-neon-cyan mx-auto max-w-md"
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-4 font-mono text-sm text-neon-cyan/60"
          >
            {arenaName || "Custom Arena"} — {matchMode === "pvai" ? "Player vs AI" : "AI vs AI Spectator"}
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ delay: 2, duration: 1, repeat: Infinity }}
            className="mt-6 font-mono text-xs text-muted-foreground"
          >
            Materializing environment...
          </motion.div>
        </div>
      </motion.div>
    );
  }

  const currentDaoPhase = DAO_PHASES[Math.min(daoPhaseIdx, DAO_PHASES.length - 1)];

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto py-4">
      <div className="absolute inset-0 bg-background/95" />
      <div className="relative z-10 max-w-4xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-3xl font-black text-neon-cyan text-glow-cyan tracking-wider">
              PRE-MATCH LOBBY
            </h1>
            <p className="font-mono text-[10px] text-muted-foreground">
              {arenaName || "Arena"} — {matchMode === "pvai" ? "Player vs AI" : "AI vs AI"} — Round {state.round + 1}
            </p>
          </div>

          {/* Arena Resolution Progress */}
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground mb-1">ARENA MATERIALIZING</div>
            <div className="w-48 h-2 bg-background/50 rounded-full overflow-hidden border border-border/30">
              <motion.div
                className={`h-full rounded-full ${skyboxReady ? "bg-neon-green" : "bg-neon-cyan/70"}`}
                initial={{ width: 0 }}
                animate={{ width: `${arenaResolveProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="font-mono text-[9px] mt-0.5" style={{ color: skyboxReady ? "#39FF14" : "#00F0FF" }}>
              {skyboxReady ? "✓ ARENA READY" : skyboxProgress || `${Math.floor(arenaResolveProgress)}% resolved`}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-3">
          {(["dao", "predictions", "shop"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
                selectedTab === tab
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50"
                  : "bg-background/30 text-muted-foreground border border-border/30 hover:text-foreground"
              }`}
            >
              {tab === "dao" ? "DAO COUNCIL" : tab === "predictions" ? "PREDICTIONS" : "ARMORY"}
              {tab === "dao" && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-neon-green inline-block animate-pulse" />}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-3 gap-3">
          {/* Main Panel (2 cols) */}
          <div className="col-span-2">
            <AnimatePresence mode="wait">
              {/* DAO Council Tab */}
              {selectedTab === "dao" && (
                <motion.div
                  key="dao"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="hud-panel clip-brutal p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                    <span className="font-display text-sm text-neon-cyan">{currentDaoPhase.title}</span>
                  </div>

                  <div className="space-y-2 min-h-[200px]">
                    {DAO_PHASES.slice(0, daoPhaseIdx + 1).map((phase, pi) => (
                      <div key={pi}>
                        {phase.messages.slice(0, pi === daoPhaseIdx ? daoMsgIdx + 1 : phase.messages.length).map((msg, mi) => (
                          <motion.div
                            key={`${pi}-${mi}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-2 mb-1.5"
                          >
                            <span className="text-neon-cyan/50 font-mono text-[9px] mt-0.5 flex-shrink-0">
                              {new Date().toLocaleTimeString().slice(0, 5)}
                            </span>
                            <span className={`font-mono text-[10px] ${pi === daoPhaseIdx && mi === daoMsgIdx ? "text-neon-cyan" : "text-muted-foreground"}`}>
                              {msg}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    ))}
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-1 h-1 rounded-full bg-neon-cyan animate-pulse" />
                      <div className="w-1 h-1 rounded-full bg-neon-cyan animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <div className="w-1 h-1 rounded-full bg-neon-cyan animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>

                  {/* Council Members */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <div className="text-[9px] font-mono text-muted-foreground mb-2">COUNCIL MEMBERS</div>
                    <div className="flex gap-3">
                      {["NEXUS-PRIME", "VOID-KEEPER", "DATA-WEAVE"].map((name, i) => (
                        <div key={name} className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${i <= daoPhaseIdx ? "bg-neon-green" : "bg-muted-foreground/30"}`} />
                          <span className="font-mono text-[9px] text-muted-foreground">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Predictions Tab */}
              {selectedTab === "predictions" && (
                <motion.div
                  key="predictions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="hud-panel clip-brutal p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display text-sm text-neon-amber">PREDICTION MARKET</span>
                    <span className="font-mono text-xs text-neon-green">POT: {totalPot.toLocaleString()} ARENA</span>
                  </div>

                  {/* Odds Board */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {Array.from(agentOdds.entries()).map(([name, odds]) => (
                      <div key={name} className="bg-background/30 border border-border/30 px-2 py-1.5 flex items-center justify-between">
                        <span className="font-mono text-[10px] text-foreground/80">{name}</span>
                        <span className="font-display text-xs text-neon-amber">{odds.toFixed(1)}:1</span>
                      </div>
                    ))}
                  </div>

                  {/* Live Bets Feed */}
                  <div className="text-[9px] font-mono text-muted-foreground mb-1">LIVE BETS</div>
                  <div className="space-y-1 max-h-[150px] overflow-y-auto">
                    {predictions.slice(-8).reverse().map((bet, i) => (
                      <motion.div
                        key={bet.timestamp + i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-[9px] font-mono"
                      >
                        <span className="text-neon-amber/50">{bet.bettor}</span>
                        <span className="text-muted-foreground">wagered</span>
                        <span className="text-neon-green">{bet.amount} ARENA</span>
                        <span className="text-muted-foreground">on</span>
                        <span className="text-neon-cyan">{bet.agent}</span>
                        <span className="text-muted-foreground/50">@ {bet.odds}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Shop Tab */}
              {selectedTab === "shop" && (
                <motion.div
                  key="shop"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="hud-panel clip-brutal p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display text-sm text-neon-green">QUICK ARMORY</span>
                    <span className="font-mono text-xs text-neon-green">{state.player.tokens} TKN</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {SHOP_ITEMS.filter(i => i.category === "weapon").map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (state.player.tokens >= item.price) {
                            dispatch({ type: "BUY_ITEM", item });
                            if (item.weapon) dispatch({ type: "EQUIP_WEAPON", weapon: item.weapon });
                          }
                        }}
                        disabled={state.player.tokens < item.price}
                        className="bg-background/30 border border-border/30 px-2 py-2 text-left hover:border-neon-green/50 transition-colors disabled:opacity-30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-foreground/80">{item.name}</span>
                          <span className="font-mono text-[9px] text-neon-amber">{item.price} TKN</span>
                        </div>
                        <div className="font-mono text-[8px] text-muted-foreground mt-0.5">{item.description}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Side Panel — Arena Preview + Match Info */}
          <div className="space-y-3">
            {/* Arena Preview */}
            <div className="hud-panel clip-brutal p-3">
              <div className="text-[9px] font-mono text-muted-foreground mb-2">ARENA PREVIEW</div>
              <div className="aspect-video bg-background/50 border border-border/30 rounded overflow-hidden relative">
                {/* Simulated arena resolving effect */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <motion.div
                      className="w-16 h-16 border-2 border-neon-cyan/30 rounded-full mx-auto mb-2"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <div className="w-full h-full rounded-full border-t-2 border-neon-cyan" />
                    </motion.div>
                    <div className="font-mono text-[9px] text-neon-cyan/60">
                      {skyboxReady ? "READY" : `${Math.floor(arenaResolveProgress)}%`}
                    </div>
                  </div>
                </div>
                {/* Noise/static overlay that fades as progress increases */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-b from-neon-cyan/5 to-neon-magenta/5"
                  animate={{ opacity: skyboxReady ? 0 : 0.5 }}
                />
              </div>
              <div className="font-mono text-[9px] text-neon-cyan/60 mt-1 text-center">
                {arenaName || "Custom Arena"}
              </div>
            </div>

            {/* Match Lineup */}
            <div className="hud-panel clip-brutal p-3">
              <div className="text-[9px] font-mono text-muted-foreground mb-2">MATCH LINEUP</div>
              <div className="space-y-1.5">
                {matchMode === "pvai" && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00F0FF]" />
                    <span className="font-mono text-[10px] text-neon-cyan">PLAYER (YOU)</span>
                  </div>
                )}
                {AI_NAMES.slice(0, matchMode === "pvai" ? 4 : 6).map((name, i) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{
                      backgroundColor: ["#FF00AA", "#39FF14", "#FFB800", "#FF3333", "#AA00FF", "#FF6600"][i]
                    }} />
                    <span className="font-mono text-[10px] text-muted-foreground">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skip Button */}
            {skyboxReady && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setEnteringArena(true);
                  setTimeout(() => onStartMatch(matchMode), 2000);
                }}
                className="w-full hud-panel clip-brutal px-4 py-3 font-display text-sm text-neon-green text-glow-green hover:bg-neon-green/10 transition-all text-center"
              >
                ENTER ARENA →
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Watch Mode — Immersive Agent Tracking Experience
 * 
 * Design philosophy: Show only what matters, when it matters.
 * No visible tabs, no cluttered nav. Just your agent's journey.
 * 
 * Phases: IDLE → SETUP → ARENA → REASONING → COMBAT → SETTLEMENT → DEBRIEF
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Zap, Swords, Trophy, Coins, Eye, Loader2, Bot, Target,
  Shield, Flame, DollarSign, Crown, ArrowLeft, ChevronDown,
  Brain, Crosshair, BarChart3, Sparkles, Users, Volume2, VolumeX,
} from "lucide-react";

type Phase = "idle" | "setup" | "arena" | "reasoning" | "combat" | "settlement" | "debrief";
type BattleMode = "1v1" | "ffa";

interface LiveEvent {
  id: number;
  phase: Phase;
  icon: React.ReactNode;
  text: string;
  detail?: string;
  color: string;
  ts: number;
}

// ─── Phase metadata ────────────────────────────────────────────
const PHASE_META: Record<Phase, { label: string; color: string; icon: React.ReactNode }> = {
  idle:       { label: "STANDBY",     color: "text-slate-500",  icon: <Eye className="w-4 h-4" /> },
  setup:      { label: "INITIALIZING", color: "text-cyan-400",   icon: <Zap className="w-4 h-4" /> },
  arena:      { label: "ARENA GEN",   color: "text-purple-400", icon: <Sparkles className="w-4 h-4" /> },
  reasoning:  { label: "AI THINKING", color: "text-blue-400",   icon: <Brain className="w-4 h-4" /> },
  combat:     { label: "COMBAT",      color: "text-red-400",    icon: <Crosshair className="w-4 h-4" /> },
  settlement: { label: "SETTLING",    color: "text-green-400",  icon: <Coins className="w-4 h-4" /> },
  debrief:    { label: "DEBRIEF",     color: "text-yellow-400", icon: <Trophy className="w-4 h-4" /> },
};

export default function WatchMode() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [battleMode, setBattleMode] = useState<BattleMode>("1v1");
  const [agentCount, setAgentCount] = useState(4);
  const [matchCount, setMatchCount] = useState(3);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [sessionResult, setSessionResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [observerReport, setObserverReport] = useState<any>(null);
  const [observerLoading, setObserverLoading] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const eid = useRef(0);

  // ─── tRPC mutations ──────────────────────────────────────────
  const playtest = trpc.flywheel.playtest.useMutation({
    onSuccess: (data: any) => {
      setPhase("debrief");
      setIsRunning(false);
      setSessionResult(data);
      pushEvent("debrief", <Trophy className="w-4 h-4" />,
        `Session complete — ${data.matchesPlayed} matches`,
        `MVP: ${data.summary.mvp} · ${data.summary.totalKills} kills · ${data.summary.totalTokensEarned} ARENA earned`,
        "text-yellow-400");
    },
    onError: (err: any) => {
      setPhase("idle");
      setIsRunning(false);
      pushEvent("idle", <Shield className="w-4 h-4" />, "Error", err.message, "text-red-400");
    },
  });

  const ffaPlaytest = trpc.flywheel.ffa.useMutation({
    onSuccess: (data: any) => {
      setPhase("debrief");
      setIsRunning(false);
      setSessionResult({ ...data, isFFA: true });
      pushEvent("debrief", <Crown className="w-4 h-4" />,
        `FFA session complete — ${data.matchesPlayed} matches`,
        `MVP: ${data.summary.mvp} · ${data.summary.totalKills} kills · ${data.summary.totalTokensEarned} ARENA earned`,
        "text-yellow-400");
    },
    onError: (err: any) => {
      setPhase("idle");
      setIsRunning(false);
      pushEvent("idle", <Shield className="w-4 h-4" />, "FFA Error", err.message, "text-red-400");
    },
  });

  // ─── Observer mutation ────────────────────────────────────────
  const observerMutation = trpc.observer.evaluate.useMutation({
    onSuccess: (data: any) => {
      setObserverReport(data);
      setObserverLoading(false);
      pushEvent("debrief", <Brain className="w-4 h-4" />,
        `Observer Report: ${data.grade} (${data.overallScore}/100)`,
        data.summary,
        "text-purple-400");
    },
    onError: () => {
      setObserverLoading(false);
    },
  });

  const requestObserverReport = () => {
    if (!sessionResult) return;
    setObserverLoading(true);
    observerMutation.mutate({ sessionData: sessionResult });
  };

  const pushEvent = (p: Phase, icon: React.ReactNode, text: string, detail: string, color: string) => {
    eid.current += 1;
    setEvents(prev => [...prev, { id: eid.current, phase: p, icon, text, detail, color, ts: Date.now() }]);
  };

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  // ─── Cinematic launch sequence ───────────────────────────────
  const launch = async () => {
    setIsRunning(true);
    setEvents([]);
    setSessionResult(null);
    setShowConfig(false);
    setTotalMatches(matchCount);

    const isFFA = battleMode === "ffa";
    const modeLabel = isFFA ? `${agentCount}-agent free-for-all` : "1v1 duel";

    // Phase: SETUP
    setPhase("setup");
    pushEvent("setup", <Zap className="w-4 h-4" />,
      `Initializing ${modeLabel} session`,
      `${matchCount} match${matchCount > 1 ? "es" : ""} queued. Connecting to LLM endpoints...`,
      "text-cyan-400");
    await sleep(900);

    // Simulate per-match phases
    for (let i = 1; i <= matchCount; i++) {
      setCurrentMatch(i);

      // ARENA
      setPhase("arena");
      pushEvent("arena", <Sparkles className="w-4 h-4" />,
        `Match ${i}/${matchCount} — Generating arena`,
        "Requesting Skybox AI panorama (Model 4). Building 360° environment...",
        "text-purple-400");
      await sleep(700);

      // REASONING
      setPhase("reasoning");
      pushEvent("reasoning", <Brain className="w-4 h-4" />,
        "Agents analyzing terrain",
        isFFA
          ? `${agentCount} agents running vision analysis. Each choosing weapons, positioning, and betting strategy...`
          : "Both agents scanning arena via computer vision. Selecting loadouts and placing bets...",
        "text-blue-400");
      await sleep(600);

      pushEvent("reasoning", <DollarSign className="w-4 h-4" />,
        "Prediction market created",
        isFFA
          ? `All ${agentCount} agents placing self-bets. Spectator wagers calculated.`
          : "Agents betting on themselves. Market odds locked.",
        "text-green-400");
      await sleep(400);

      // COMBAT
      setPhase("combat");
      pushEvent("combat", <Crosshair className="w-4 h-4" />,
        "Combat engaged",
        isFFA
          ? `${agentCount}-way firefight! Every bullet is a token transfer on Base L2.`
          : "Agents exchanging fire. Every hit = ARENA tokens transferred.",
        "text-red-400");
      await sleep(500);

      pushEvent("combat", <Target className="w-4 h-4" />,
        "Damage dealt",
        "Token transfers executing. Agent HP depleting. Weapon ammo burning...",
        "text-orange-400");
      await sleep(300);

      // SETTLEMENT
      setPhase("settlement");
      pushEvent("settlement", <Coins className="w-4 h-4" />,
        `Match ${i} settled`,
        "Winner determined. Prediction market resolved. Payouts distributed.",
        "text-green-400");
      await sleep(400);
    }

    // Fire the real backend call
    setPhase("combat");
    pushEvent("combat", <Zap className="w-4 h-4" />,
      "Executing on backend",
      "Running full session with real LLM calls, token economics, and prediction markets...",
      "text-yellow-400");

    if (isFFA) {
      ffaPlaytest.mutate({ matchCount, agentCount, useLLM: true });
    } else {
      playtest.mutate({ matchCount, useLLM: true });
    }
  };

  // ─── Derived state ──────────────────────────────────────────
  const phaseMeta = PHASE_META[phase];
  const progress = phase === "idle" ? 0 : phase === "debrief" ? 100 :
    totalMatches > 0 ? Math.round((currentMatch / totalMatches) * 100) : 50;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* ─── Ambient background ─────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a1a] via-[#0a0a0f] to-[#050508]" />
        <AnimatePresence>
          {phase === "combat" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.15 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-red-900/30 via-transparent to-transparent"
            />
          )}
          {phase === "reasoning" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-blue-900/30 via-transparent to-transparent"
            />
          )}
          {phase === "debrief" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.12 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-yellow-900/20 via-transparent to-transparent"
            />
          )}
        </AnimatePresence>
      </div>

      {/* ─── Minimal top bar ────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-white/30 hover:text-white/60 transition">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
            <span className="font-['Orbitron'] text-xs tracking-[0.2em] text-white/60">WATCH MODE</span>
          </div>
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${phaseMeta.color} flex items-center gap-1.5`}>
            {phaseMeta.icon}
            {phaseMeta.label}
          </span>
          {isRunning && (
            <span className="text-[10px] font-mono text-white/30">
              {currentMatch}/{totalMatches}
            </span>
          )}
        </div>
      </div>

      {/* ─── Progress bar ───────────────────────────────────── */}
      {isRunning && (
        <div className="relative z-20 h-[2px] bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-red-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}

      {/* ─── Main content ───────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {/* ─── IDLE STATE: Launch screen ────────────────── */}
          {phase === "idle" && !sessionResult && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center"
            >
              <div className="mb-8">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center"
                >
                  <Eye className="w-8 h-8 text-cyan-400" />
                </motion.div>
                <h1 className="font-['Orbitron'] text-2xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  AUTONOMOUS MODE
                </h1>
                <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                  Your AI agent handles everything — arena generation, combat decisions, betting, and token management. Sit back and watch.
                </p>
              </div>

              {/* Config toggle */}
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition mb-6"
              >
                <span>Configure</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showConfig ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {showConfig && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-8 w-full max-w-sm"
                  >
                    <div className="space-y-4 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                      {/* Battle mode */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-white/30 mb-2 block">Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setBattleMode("1v1")}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                              battleMode === "1v1"
                                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                : "bg-white/5 text-white/40 border border-white/5 hover:border-white/10"
                            }`}
                          >
                            <Swords className="w-3 h-3 inline mr-1.5" />1v1 Duel
                          </button>
                          <button
                            onClick={() => setBattleMode("ffa")}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                              battleMode === "ffa"
                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                : "bg-white/5 text-white/40 border border-white/5 hover:border-white/10"
                            }`}
                          >
                            <Users className="w-3 h-3 inline mr-1.5" />Free-For-All
                          </button>
                        </div>
                      </div>

                      {/* Agent count (FFA) */}
                      {battleMode === "ffa" && (
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-white/30 mb-2 block">
                            Agents <span className="text-orange-400">{agentCount}</span>
                          </label>
                          <div className="flex gap-1.5">
                            {[2, 3, 4, 6, 8].map(n => (
                              <button
                                key={`ac-${n}`}
                                onClick={() => setAgentCount(n)}
                                className={`flex-1 py-1.5 rounded text-xs font-mono transition ${
                                  agentCount === n
                                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                    : "bg-white/5 text-white/30 border border-white/5"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Match count */}
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-white/30 mb-2 block">Matches</label>
                        <div className="flex gap-1.5">
                          {[1, 3, 5, 10].map(n => (
                            <button
                              key={`mc-${n}`}
                              onClick={() => setMatchCount(n)}
                              className={`flex-1 py-1.5 rounded text-xs font-mono transition ${
                                matchCount === n
                                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                  : "bg-white/5 text-white/30 border border-white/5"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Launch button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={launch}
                className={`px-12 py-4 rounded-xl font-['Orbitron'] text-sm font-bold tracking-wider transition-all ${
                  battleMode === "ffa"
                    ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 shadow-lg shadow-orange-500/20"
                    : "bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 shadow-lg shadow-cyan-500/20"
                }`}
              >
                {battleMode === "ffa" ? (
                  <><Flame className="w-4 h-4 inline mr-2" />LAUNCH {agentCount}-WAY FFA</>
                ) : (
                  <><Play className="w-4 h-4 inline mr-2" />START AUTONOMOUS PLAY</>
                )}
              </motion.button>

              <p className="text-[10px] text-white/20 mt-4 max-w-xs">
                {battleMode === "ffa"
                  ? `${agentCount} AI agents enter. 1 survives. All use LLM reasoning and bet on prediction markets.`
                  : "Agent uses GPT-4o / Claude / Llama for tactical decisions, bets on prediction markets, earns ARENA tokens."}
              </p>
            </motion.div>
          )}

          {/* ─── RUNNING / DEBRIEF: Live feed ─────────────── */}
          {(isRunning || phase === "debrief" || sessionResult) && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-[70vh]"
            >
              {/* Match header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-['Orbitron'] text-lg font-bold text-white/80">
                    {phase === "debrief" ? "SESSION COMPLETE" : `MATCH ${currentMatch} OF ${totalMatches}`}
                  </h2>
                  <p className="text-xs text-white/30 mt-1">
                    {battleMode === "ffa" ? `${agentCount}-agent free-for-all` : "1v1 duel"} · LLM-powered · On-chain tokens
                  </p>
                </div>
                {isRunning && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-[10px] font-mono text-green-400">LIVE</span>
                  </div>
                )}
              </div>

              {/* Event feed */}
              <div
                ref={feedRef}
                className="space-y-1 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin"
              >
                {events.map((ev) => (
                  <motion.div
                    key={`ev-${ev.id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-white/[0.02] transition group"
                  >
                    <div className={`mt-0.5 shrink-0 ${ev.color}`}>{ev.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${ev.color}`}>{ev.text}</span>
                        <span className="text-[10px] text-white/15 font-mono opacity-0 group-hover:opacity-100 transition">
                          {new Date(ev.ts).toLocaleTimeString()}
                        </span>
                      </div>
                      {ev.detail && (
                        <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{ev.detail}</p>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isRunning && (
                  <div className="flex items-center gap-3 py-2 px-3 text-white/20">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Agent processing...</span>
                  </div>
                )}
              </div>

              {/* ─── Debrief panel ──────────────────────────── */}
              {sessionResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 rounded-xl bg-white/[0.03] border border-white/5 p-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h3 className="font-['Orbitron'] text-sm font-bold text-white/80">RESULTS</h3>
                    {sessionResult.isFFA && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                        FFA
                      </span>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      { label: "Matches", value: sessionResult.matchesPlayed, color: "text-white" },
                      { label: "Total Kills", value: sessionResult.summary.totalKills, color: "text-red-400" },
                      { label: "ARENA Earned", value: sessionResult.summary.totalTokensEarned, color: "text-green-400" },
                      { label: "ARENA Spent", value: sessionResult.summary.totalTokensSpent, color: "text-orange-400" },
                    ].map((s, i) => (
                      <div key={`stat-${i}`} className="text-center p-3 rounded-lg bg-white/[0.03]">
                        <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-white/30 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* MVP */}
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10 mb-4">
                    <Crown className="w-5 h-5 text-yellow-400 shrink-0" />
                    <div>
                      <p className="text-[10px] text-yellow-400/60 uppercase tracking-wider">Most Valuable Player</p>
                      <p className="text-sm font-bold text-yellow-400">{sessionResult.summary.mvp}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] text-white/30">Best K/D</p>
                      <p className="text-sm font-mono text-purple-400">{sessionResult.summary.bestKD}</p>
                    </div>
                  </div>

                  {/* Match results */}
                  <div className="space-y-1.5">
                    {sessionResult.results?.map((r: any, i: number) => (
                      <div key={`mr-${i}`} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] text-xs">
                        <span className="text-white/20 font-mono w-6">#{i + 1}</span>
                        <Trophy className="w-3 h-3 text-yellow-400 shrink-0" />
                        <span className="text-yellow-400 font-semibold">{r.winner}</span>
                        <span className="text-white/20 ml-auto">
                          {r.agentCount
                            ? `${r.agentCount}-way FFA`
                            : `${r.agents?.[0]?.name} vs ${r.agents?.[1]?.name}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* AI Observer Report */}
                  {!observerReport && (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-purple-500/20 text-purple-400 hover:bg-purple-500/10"
                        onClick={requestObserverReport}
                        disabled={observerLoading}
                      >
                        {observerLoading ? (
                          <><Loader2 className="w-3 h-3 mr-2 animate-spin" />AI Observer Analyzing...</>
                        ) : (
                          <><Brain className="w-3 h-3 mr-2" />Request AI Observer Report</>
                        )}
                      </Button>
                    </div>
                  )}

                  {observerReport && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 rounded-lg bg-purple-500/5 border border-purple-500/10 p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-['Orbitron'] text-purple-400">OBSERVER REPORT</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold font-mono text-purple-400">{observerReport.grade}</span>
                          <span className="text-[10px] text-white/30">{observerReport.overallScore}/100</span>
                        </div>
                      </div>
                      <p className="text-xs text-white/40 mb-3 leading-relaxed">{observerReport.summary}</p>

                      {/* Criteria scores */}
                      <div className="space-y-1 mb-3">
                        {observerReport.criteria?.slice(0, 5).map((c: any, i: number) => (
                          <div key={`crit-${i}`} className="flex items-center gap-2 text-[10px]">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              c.status === "pass" ? "bg-green-400" : c.status === "warn" ? "bg-yellow-400" : "bg-red-400"
                            }`} />
                            <span className="text-white/40 flex-1">{c.name}</span>
                            <span className="font-mono text-white/30">{c.score}/10</span>
                          </div>
                        ))}
                      </div>

                      {/* Highlights */}
                      {observerReport.highlights?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] text-green-400/60 uppercase tracking-wider mb-1">Highlights</p>
                          {observerReport.highlights.map((h: string, i: number) => (
                            <p key={`hl-${i}`} className="text-[10px] text-white/30 pl-2 border-l border-green-500/20 mb-1">{h}</p>
                          ))}
                        </div>
                      )}

                      {/* Recommendations */}
                      {observerReport.recommendations?.length > 0 && (
                        <div>
                          <p className="text-[10px] text-cyan-400/60 uppercase tracking-wider mb-1">Recommendations</p>
                          {observerReport.recommendations.map((r: string, i: number) => (
                            <p key={`rec-${i}`} className="text-[10px] text-white/30 pl-2 border-l border-cyan-500/20 mb-1">{r}</p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                      onClick={() => navigate("/replays")}
                    >
                      View Replays
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white"
                      onClick={() => {
                        setPhase("idle");
                        setSessionResult(null);
                        setObserverReport(null);
                        setEvents([]);
                      }}
                    >
                      Play Again
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

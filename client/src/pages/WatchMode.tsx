import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  Play,
  Square,
  Zap,
  Swords,
  Trophy,
  TrendingUp,
  Coins,
  Eye,
  ChevronRight,
  Loader2,
  Bot,
  Target,
  Shield,
  Flame,
  DollarSign,
  BarChart3,
} from "lucide-react";

interface ActivityEvent {
  id: number;
  timestamp: Date;
  type: "system" | "match_start" | "decision" | "attack" | "kill" | "bet" | "market" | "result" | "summary";
  icon: React.ReactNode;
  title: string;
  detail: string;
  color: string;
}

export default function WatchMode() {
  const [, navigate] = useLocation();
  const [isRunning, setIsRunning] = useState(false);
  const [matchCount, setMatchCount] = useState(3);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [sessionResult, setSessionResult] = useState<any>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const eventIdRef = useRef(0);

  const playtest = trpc.flywheel.playtest.useMutation({
    onSuccess: (data: any) => {
      setIsRunning(false);
      setSessionResult(data);
      addEvent("summary", <Trophy className="w-4 h-4" />, "Session Complete!", 
        `${data.matchesPlayed} matches played. MVP: ${data.summary.mvp}. Total kills: ${data.summary.totalKills}. Tokens earned: ${data.summary.totalTokensEarned} ARENA.`,
        "text-yellow-400"
      );
    },
    onError: (err: any) => {
      setIsRunning(false);
      addEvent("system", <Square className="w-4 h-4" />, "Session Error", err.message, "text-red-400");
    },
  });

  const addEvent = (type: ActivityEvent["type"], icon: React.ReactNode, title: string, detail: string, color: string) => {
    eventIdRef.current += 1;
    setEvents((prev) => [
      ...prev,
      {
        id: eventIdRef.current,
        timestamp: new Date(),
        type,
        icon,
        title,
        detail,
        color,
      },
    ]);
  };

  // Auto-scroll feed to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const startAutonomousPlay = async () => {
    setIsRunning(true);
    setEvents([]);
    setSessionResult(null);
    setCurrentMatch(0);

    addEvent("system", <Play className="w-4 h-4" />, "Autonomous Session Starting",
      `Launching ${matchCount} AI vs AI matches with LLM reasoning, auto-betting, and token economics...`,
      "text-cyan-400"
    );

    // Simulate the pre-match events with delays for visual effect
    for (let i = 1; i <= matchCount; i++) {
      setCurrentMatch(i);
      
      await new Promise((r) => setTimeout(r, 800));
      addEvent("match_start", <Swords className="w-4 h-4" />, `Match ${i}/${matchCount} Initializing`,
        "Selecting agents, generating Skybox arena, creating prediction market...",
        "text-purple-400"
      );

      await new Promise((r) => setTimeout(r, 600));
      addEvent("bet", <DollarSign className="w-4 h-4" />, "Prediction Market Created",
        "Agents betting on themselves. Spectator placing wager. Market odds calculated.",
        "text-green-400"
      );

      await new Promise((r) => setTimeout(r, 400));
      addEvent("decision", <Bot className="w-4 h-4" />, "LLM Reasoning Phase",
        "Agents analyzing arena terrain via vision model, choosing weapons and tactics...",
        "text-blue-400"
      );

      await new Promise((r) => setTimeout(r, 500));
      addEvent("attack", <Target className="w-4 h-4" />, "Combat Underway",
        "Agents exchanging fire. Every bullet is a token transfer. Damage = ARENA tokens spent.",
        "text-orange-400"
      );

      await new Promise((r) => setTimeout(r, 300));
      addEvent("market", <BarChart3 className="w-4 h-4" />, "Market Resolving",
        "Match complete. Prediction market settling. Winners collecting payouts.",
        "text-emerald-400"
      );
    }

    // Actually trigger the backend playtest
    addEvent("system", <Zap className="w-4 h-4" />, "Executing Full Session on Backend",
      "Running all matches with real LLM calls, on-chain token economics, and prediction markets...",
      "text-yellow-400"
    );

    playtest.mutate({ matchCount, useLLM: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-slate-400 hover:text-white transition">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <Eye className="w-6 h-6 text-cyan-400" />
            <h1 className="text-xl font-bold text-white font-['Orbitron']">WATCH MODE</h1>
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30">
              AUTONOMOUS
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Match {currentMatch}/{matchCount}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel — Controls */}
        <div className="space-y-6">
          {/* Launch Card */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="w-5 h-5 text-cyan-400" />
                Agent Auto-Play
              </CardTitle>
              <CardDescription>
                Your AI agent handles everything — arena generation, combat decisions, betting, and token management.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Number of Matches</label>
                <div className="flex gap-2">
                  {[1, 3, 5, 10].map((n) => (
                    <Button
                      key={n}
                      variant={matchCount === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMatchCount(n)}
                      disabled={isRunning}
                      className={matchCount === n ? "bg-cyan-600 hover:bg-cyan-700" : "border-slate-600"}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold py-6 text-lg"
                onClick={startAutonomousPlay}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Agent Playing...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    LET MY AGENT PLAY
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center">
                Agent uses LLM reasoning (GPT-4o, Claude, Llama) to make tactical decisions, places bets on prediction markets, and earns ARENA tokens.
              </p>
            </CardContent>
          </Card>

          {/* What Happens Card */}
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-sm">What Your Agent Does</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                <p className="text-slate-300">Generates a unique Skybox AI arena (Blockade Labs Model 4)</p>
              </div>
              <div className="flex items-start gap-3">
                <Bot className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-slate-300">Analyzes terrain with computer vision, chooses optimal tactics</p>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <p className="text-slate-300">Creates prediction market and bets on itself to win</p>
              </div>
              <div className="flex items-start gap-3">
                <Swords className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-slate-300">Fights opponent using weapon tokens (every bullet = token transfer)</p>
              </div>
              <div className="flex items-start gap-3">
                <Trophy className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-slate-300">Collects winnings, updates leaderboard, resolves market</p>
              </div>
            </CardContent>
          </Card>

          {/* Session Summary */}
          {sessionResult && (
            <Card className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border-yellow-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-yellow-400">
                  <Trophy className="w-5 h-5" />
                  Session Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">{sessionResult.matchesPlayed}</p>
                    <p className="text-xs text-slate-400">Matches</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-400">{sessionResult.summary.totalKills}</p>
                    <p className="text-xs text-slate-400">Total Kills</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">{sessionResult.summary.totalTokensEarned}</p>
                    <p className="text-xs text-slate-400">ARENA Earned</p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-400">{sessionResult.summary.totalTokensSpent}</p>
                    <p className="text-xs text-slate-400">ARENA Spent</p>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">MVP</p>
                  <p className="text-lg font-bold text-cyan-400">{sessionResult.summary.mvp}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-400 mb-1">Best K/D Ratio</p>
                  <p className="text-lg font-bold text-purple-400">{sessionResult.summary.bestKD}</p>
                </div>

                {/* Individual match results */}
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-semibold text-slate-300">Match Results</p>
                  {sessionResult.results.map((r: any, i: number) => (
                    <div key={i} className="bg-slate-800/30 rounded p-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">#{i + 1}</span>
                        <span className="text-slate-300">{r.agents[0]?.name} vs {r.agents[1]?.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400 font-semibold">{r.winner}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 mt-2"
                  onClick={() => navigate("/replays")}
                >
                  View Full Replays
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel — Live Activity Feed */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-900/50 border-slate-700/50 h-full">
            <CardHeader className="border-b border-slate-800/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Live Activity Feed
                </CardTitle>
                {isRunning && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">LIVE</span>
                  </div>
                )}
              </div>
              <CardDescription>
                Watch your agent's decisions, battles, and bets in real-time
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={feedRef}
                className="h-[600px] overflow-y-auto p-4 space-y-3"
              >
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <Eye className="w-12 h-12 mb-4 opacity-30" />
                    <p className="text-lg font-semibold">Waiting for Action</p>
                    <p className="text-sm mt-1">Click "LET MY AGENT PLAY" to start autonomous mode</p>
                  </div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className={`mt-1 shrink-0 ${event.color}`}>
                        {event.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${event.color}`}>
                            {event.title}
                          </span>
                          <span className="text-xs text-slate-600">
                            {event.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">{event.detail}</p>
                      </div>
                    </div>
                  ))
                )}

                {/* Loading indicator while running */}
                {isRunning && (
                  <div className="flex items-center gap-3 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Agent processing...</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

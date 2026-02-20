/**
 * Population Dynamics Dashboard — visualize the self-sustaining ecosystem
 * Shows agent births/deaths, treasury flows, economy health, token velocity, and prediction markets
 */
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import WalletButton from "@/components/WalletButton";

interface EcoSnapshot {
  id: number;
  agentsAlive: number;
  agentsDead: number;
  totalMatches: number;
  treasuryBalance: number;
  totalTokensCirculating: number;
  tokenVelocity: number;
  economyHealth: number;
  predictionVolume: number;
  activeBets: number;
  avgAgentWealth: number;
  giniCoefficient: number;
  createdAt: Date | string;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="p-4 border border-gray-800 rounded-lg bg-gray-900/50">
      <div className="font-['JetBrains_Mono'] text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="font-['Orbitron'] text-2xl font-black" style={{ color }}>{value}</div>
      {sub && <div className="font-['JetBrains_Mono'] text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-['JetBrains_Mono'] mb-1">
        <span className="text-gray-400">{label}</span>
        <span style={{ color }}>{value.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function TimelineChart({ snapshots }: { snapshots: EcoSnapshot[] }) {
  if (snapshots.length === 0) return null;
  const maxHealth = 100;
  const maxBalance = Math.max(...snapshots.map(s => s.treasuryBalance), 1);
  const maxAgents = Math.max(...snapshots.map(s => s.agentsAlive + s.agentsDead), 1);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-4">ECOSYSTEM TIMELINE</h3>
      <div className="relative h-48 overflow-hidden">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => (
          <div key={pct} className="absolute left-0 right-0 border-t border-gray-800/50"
            style={{ bottom: `${pct}%` }}>
            <span className="absolute -left-1 -translate-y-1/2 text-[10px] font-['JetBrains_Mono'] text-gray-700">
              {pct}%
            </span>
          </div>
        ))}

        {/* Data points */}
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${Math.max(snapshots.length * 40, 200)} 100`} preserveAspectRatio="none">
          {/* Economy Health line */}
          <polyline
            fill="none"
            stroke="#00FFD1"
            strokeWidth="2"
            points={snapshots.map((s, i) => `${i * 40 + 20},${100 - (s.economyHealth / maxHealth) * 100}`).join(" ")}
          />
          {/* Treasury line */}
          <polyline
            fill="none"
            stroke="#0052FF"
            strokeWidth="2"
            strokeDasharray="4,4"
            points={snapshots.map((s, i) => `${i * 40 + 20},${100 - (s.treasuryBalance / maxBalance) * 100}`).join(" ")}
          />
          {/* Agent count line */}
          <polyline
            fill="none"
            stroke="#FF00FF"
            strokeWidth="2"
            strokeDasharray="2,2"
            points={snapshots.map((s, i) => `${i * 40 + 20},${100 - (s.agentsAlive / maxAgents) * 100}`).join(" ")}
          />
        </svg>
      </div>
      <div className="flex gap-4 mt-3 text-xs font-['JetBrains_Mono']">
        <span className="text-[#00FFD1]">━ Economy Health</span>
        <span className="text-[#0052FF]">┄ Treasury</span>
        <span className="text-[#FF00FF]">┈ Alive Agents</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch ecosystem data
  const ecosystemQuery = trpc.dao.ecosystem.useQuery(undefined, {
    refetchInterval: autoRefresh ? 10000 : false,
  });
  const treasuryQuery = trpc.dao.treasury.useQuery(undefined, {
    refetchInterval: autoRefresh ? 10000 : false,
  });
  const councilQuery = trpc.dao.council.useQuery();
  const snapshotsQuery = trpc.ecosystem.history.useQuery({ limit: 50 }, {
    refetchInterval: autoRefresh ? 15000 : false,
  });
  const openMarketsQuery = trpc.prediction.open.useQuery(undefined, {
    refetchInterval: autoRefresh ? 10000 : false,
  });
  const resolvedMarketsQuery = trpc.prediction.resolved.useQuery({ limit: 5 });
  const metaQuery = trpc.gameMaster.latestSnapshot.useQuery(undefined, {
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const takeSnapshot = trpc.ecosystem.snapshot.useMutation({
    onSuccess: () => snapshotsQuery.refetch(),
  });

  const eco = ecosystemQuery.data;
  const treasury = treasuryQuery.data;
  const snapshots = (snapshotsQuery.data || []) as EcoSnapshot[];
  const openMarkets = openMarketsQuery.data || [];
  const resolvedMarkets = resolvedMarketsQuery.data || [];
  const meta = metaQuery.data;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur border-b border-cyan-500/20">
        <div className="container flex items-center justify-between h-16">
          <button onClick={() => navigate("/")} className="font-['Orbitron'] text-cyan-400 font-bold tracking-wider">
            TOKEN ARENA
          </button>
          <div className="flex items-center gap-6 font-['Space_Grotesk'] text-sm">
            <button onClick={() => navigate("/arena")} className="text-gray-400 hover:text-cyan-400 transition">PLAY</button>
            <button onClick={() => navigate("/shop")} className="text-gray-400 hover:text-cyan-400 transition">ARMORY</button>
            <button onClick={() => navigate("/demo")} className="text-gray-400 hover:text-cyan-400 transition">DEMO</button>
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="pt-24 pb-16 container">
        {/* Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-['Orbitron'] text-3xl font-black text-cyan-400 mb-2">ECOSYSTEM DASHBOARD</h1>
            <p className="font-['Space_Grotesk'] text-sm text-gray-500">
              Population dynamics, treasury flows, and economy health — real-time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => takeSnapshot.mutate()}
              disabled={takeSnapshot.isPending}
              className="px-3 py-1.5 border border-cyan-500/50 text-cyan-400 font-['JetBrains_Mono'] text-xs hover:bg-cyan-500/10 transition disabled:opacity-50"
            >
              {takeSnapshot.isPending ? "CAPTURING..." : "📸 SNAPSHOT"}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 border font-['JetBrains_Mono'] text-xs transition ${
                autoRefresh ? "border-green-500/50 text-green-400" : "border-gray-700 text-gray-500"
              }`}
            >
              {autoRefresh ? "● LIVE" : "○ PAUSED"}
            </button>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Alive Agents" value={eco?.agents?.alive ?? 6} color="#00FFD1" sub="Active combatants" />
          <StatCard label="Dead Agents" value={eco?.agents?.dead ?? 0} color="#FF4444" sub="Bankrupt / killed" />
          <StatCard label="Treasury" value={`${(typeof treasury === 'object' ? treasury?.balance ?? 0 : 0).toLocaleString()} Ⓐ`} color="#0052FF" sub="DAO funds" />
          <StatCard label="Economy Health" value={`${meta?.economyHealth ?? 75}%`} color={
            (meta?.economyHealth ?? 75) > 70 ? "#00FFD1" : (meta?.economyHealth ?? 75) > 40 ? "#FFD700" : "#FF4444"
          } sub="Game Master rating" />
          <StatCard label="Open Markets" value={openMarkets.length} color="#FF6B00" sub="Active predictions" />
          <StatCard label="Total Matches" value={0} color="#FF00FF" sub="Played to date" />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column — Economy Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timeline Chart */}
            <TimelineChart snapshots={snapshots} />

            {/* Economy Bars */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-4">ECONOMY METRICS</h3>
              <MiniBar label="Agent Sustainability Rate" value={50} max={100} color="#00FFD1" />
              <MiniBar label="Token Velocity" value={50} max={200} color="#0052FF" />
              <MiniBar label="Crafting Activity" value={0} max={100} color="#FF6B00" />
              <MiniBar label="Trade Volume" value={0} max={100} color="#FF00FF" />
              <MiniBar label="Prediction Market Volume" value={0} max={1000} color="#FFD700" />
            </div>

            {/* Game Master Analysis */}
            {meta && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-3">LATEST META ANALYSIS</h3>
                <div className="font-['Space_Grotesk'] text-sm text-gray-300 leading-relaxed mb-3">
                  {typeof meta.analysis === "string" ? meta.analysis : "No analysis available yet."}
                </div>
                <div className="flex gap-4 text-xs font-['JetBrains_Mono'] text-gray-500">
                  <span>Dominant: {typeof meta.dominantStrategy === "string" ? meta.dominantStrategy : "balanced"}</span>
                  <span>Health: {meta.economyHealth}%</span>
                </div>
              </div>
            )}

            {/* Prediction Markets */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-4">PREDICTION MARKETS</h3>
              {openMarkets.length === 0 && resolvedMarkets.length === 0 ? (
                <div className="text-center py-8 text-gray-600 font-['JetBrains_Mono'] text-xs">
                  No prediction markets yet. Start a match to generate predictions.
                </div>
              ) : (
                <div className="space-y-3">
                  {openMarkets.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-3 border border-green-500/20 rounded bg-green-500/5">
                      <div>
                        <div className="font-['Space_Grotesk'] text-sm text-green-400">{m.title}</div>
                        <div className="font-['JetBrains_Mono'] text-xs text-gray-500">
                          Pool: {m.totalPool ?? 0} Ⓐ · {m.totalBets ?? 0} bets
                        </div>
                      </div>
                      <span className="px-2 py-0.5 border border-green-500/50 text-green-400 font-['JetBrains_Mono'] text-xs">OPEN</span>
                    </div>
                  ))}
                  {resolvedMarkets.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-3 border border-gray-700 rounded bg-gray-800/30">
                      <div>
                        <div className="font-['Space_Grotesk'] text-sm text-gray-400">{m.title}</div>
                        <div className="font-['JetBrains_Mono'] text-xs text-gray-600">
                          Pool: {m.totalPool ?? 0} Ⓐ · Resolved
                        </div>
                      </div>
                      <span className="px-2 py-0.5 border border-gray-600 text-gray-500 font-['JetBrains_Mono'] text-xs">RESOLVED</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column — DAO Council + Agent Roster */}
          <div className="space-y-6">
            {/* DAO Council */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-4">DAO COUNCIL</h3>
              <div className="space-y-3">
                {(councilQuery.data || []).map((m: any) => (
                  <div key={m.id} className="p-3 border border-gray-700 rounded bg-black/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-['Orbitron'] text-xs text-cyan-400">{m.name}</span>
                      <span className="font-['JetBrains_Mono'] text-[10px] text-gray-600">{m.philosophy}</span>
                    </div>
                    <div className="font-['Space_Grotesk'] text-xs text-gray-500 line-clamp-2">{m.description}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Roster */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-4">AGENT ROSTER</h3>
              <div className="space-y-2">
                {/* Agent summary */}
                <div className="p-3 border border-green-500/20 rounded bg-green-500/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-['Orbitron'] text-xs text-[#00FFD1]">ALIVE</span>
                    <span className="font-['JetBrains_Mono'] text-lg text-green-400">{eco?.agents?.alive ?? 6}</span>
                  </div>
                </div>
                <div className="p-3 border border-red-500/20 rounded bg-red-500/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-['Orbitron'] text-xs text-[#FF4444]">DEAD</span>
                    <span className="font-['JetBrains_Mono'] text-lg text-red-400">{eco?.agents?.dead ?? 0}</span>
                  </div>
                </div>
                <div className="p-3 border border-cyan-500/20 rounded bg-cyan-500/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-['Orbitron'] text-xs text-cyan-400">TOTAL POPULATION</span>
                    <span className="font-['JetBrains_Mono'] text-lg text-cyan-400">{eco?.agents?.totalPopulation ?? 6}</span>
                  </div>
                </div>
                {(!eco?.agents) && (
                  <div className="text-center py-4 text-gray-600 font-['JetBrains_Mono'] text-xs">
                    No agents registered yet. Play a match to populate.
                  </div>
                )}
              </div>
            </div>

            {/* Fee Structure */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-4">FEE STRUCTURE → DAO</h3>
              <div className="space-y-2 font-['JetBrains_Mono'] text-xs">
                {[
                  { label: "Match Entry", rate: "5%", color: "#00FFD1" },
                  { label: "Shop Purchase", rate: "3%", color: "#0052FF" },
                  { label: "Crafting Tax", rate: "5%", color: "#FF6B00" },
                  { label: "Trade Tax", rate: "2%", color: "#FF00FF" },
                  { label: "Death Tax", rate: "10%", color: "#FF4444" },
                  { label: "Token Conversion", rate: "1%", color: "#FFD700" },
                  { label: "Prediction House", rate: "5%", color: "#9945FF" },
                ].map((fee, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-400">{fee.label}</span>
                    <span style={{ color: fee.color }}>{fee.rate}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h3 className="font-['Orbitron'] text-sm text-gray-400 mb-4">QUICK ACTIONS</h3>
              <div className="space-y-2">
                <button onClick={() => navigate("/arena")}
                  className="w-full px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-['Orbitron'] text-xs hover:bg-cyan-500/20 transition">
                  ⚔ ENTER ARENA
                </button>
                <button onClick={() => navigate("/shop")}
                  className="w-full px-3 py-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 font-['Orbitron'] text-xs hover:bg-purple-500/20 transition">
                  🛒 VISIT ARMORY
                </button>
                <button onClick={() => navigate("/leaderboard")}
                  className="w-full px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-['Orbitron'] text-xs hover:bg-yellow-500/20 transition">
                  🏆 LEADERBOARD
                </button>
                <button onClick={() => navigate("/demo")}
                  className="w-full px-3 py-2 bg-green-500/10 border border-green-500/30 text-green-400 font-['Orbitron'] text-xs hover:bg-green-500/20 transition">
                  📋 BOUNTY DEMO
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

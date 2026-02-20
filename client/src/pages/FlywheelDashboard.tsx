/**
 * Flywheel Dashboard — Visualizes the self-sustaining agent economy loop
 * Shows: Token Earnings → Compute Budget → LLM Spending → Smarter Play → More Earnings
 * Critical for Base bounty demo ($10K)
 */
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import { useState } from "react";

const TRAJECTORY_COLORS: Record<string, string> = {
  ascending: "#39FF14",
  stable: "#00F0FF",
  declining: "#FFB800",
  bankrupt: "#FF3366",
};

const TRAJECTORY_LABELS: Record<string, string> = {
  ascending: "ASCENDING",
  stable: "STABLE",
  declining: "DECLINING",
  bankrupt: "BANKRUPT",
};

function ProgressBar({ value, max, color, label, sublabel }: {
  value: number; max: number; color: string; label: string; sublabel?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono" style={{ color }}>{value.toLocaleString()}{sublabel ? ` ${sublabel}` : ""}</span>
      </div>
      <div className="h-2 bg-gray-900 rounded-sm overflow-hidden">
        <motion.div
          className="h-full rounded-sm"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
        />
      </div>
    </div>
  );
}

function FlywheelDiagram() {
  return (
    <div className="relative w-full max-w-md mx-auto py-6">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {[
          { label: "EARN TOKENS", icon: "💰", color: "#39FF14", desc: "Win matches, collect hits" },
          { label: "→", icon: "", color: "#444", desc: "" },
          { label: "COMPUTE BUDGET", icon: "⚡", color: "#00F0FF", desc: "Tokens → LLM calls" },
          { label: "→", icon: "", color: "#444", desc: "" },
          { label: "SMARTER PLAY", icon: "🧠", color: "#9D00FF", desc: "Better decisions" },
          { label: "→", icon: "", color: "#444", desc: "" },
          { label: "WIN MORE", icon: "🏆", color: "#FFB800", desc: "Higher earnings" },
        ].map((step, i) =>
          step.icon === "" ? (
            <span key={i} className="text-gray-600 font-mono text-lg">→</span>
          ) : (
            <div key={i} className="text-center px-2 py-2 rounded border border-gray-800" style={{ borderColor: `${step.color}33` }}>
              <div className="text-xl mb-1">{step.icon}</div>
              <div className="text-[9px] font-mono font-bold" style={{ color: step.color }}>{step.label}</div>
              <div className="text-[8px] font-mono text-gray-500">{step.desc}</div>
            </div>
          )
        )}
      </div>
      <div className="text-center mt-2">
        <span className="text-[9px] font-mono text-gray-600">↻ Self-sustaining loop — agents that earn more get smarter</span>
      </div>
    </div>
  );
}

export default function FlywheelDashboard() {
  const [, navigate] = useLocation();
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);

  const { data: flywheelData, isLoading: fwLoading } = trpc.flywheel.all.useQuery(undefined, { staleTime: 10000 });
  const { data: healthData, isLoading: hLoading } = trpc.flywheel.health.useQuery(undefined, { staleTime: 10000 });
  const { data: ecosystemState } = trpc.dao.ecosystem.useQuery(undefined, { staleTime: 10000 });

  const maxEarnings = Math.max(1, ...(flywheelData || []).map(a => a.earnings));
  const maxSpending = Math.max(1, ...(flywheelData || []).map(a => a.spending));
  const maxCompute = Math.max(1, ...(flywheelData || []).map(a => a.computeBudget));

  const selected = selectedAgent !== null ? flywheelData?.find(a => a.agentId === selectedAgent) : null;

  return (
    <div className="min-h-screen relative bg-background">
      <div className="fixed inset-0 scanline-overlay opacity-10 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="text-xs font-mono text-muted-foreground hover:text-neon-cyan transition-colors">
              ← LOBBY
            </button>
            <div className="w-px h-6 bg-border/30" />
            <h1 className="font-display text-xl font-bold text-neon-cyan text-glow-cyan tracking-wider">
              TOKEN FLYWHEEL
            </h1>
            <span className="text-[9px] font-mono text-muted-foreground/60 bg-neon-cyan/5 px-2 py-0.5 border border-neon-cyan/10">
              BASE L2 ECONOMICS
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/arena")} className="clip-brutal-sm px-4 py-1.5 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan font-mono text-xs hover:bg-neon-cyan/20 transition-colors">
              ENTER ARENA
            </button>
            <button onClick={() => navigate("/dashboard")} className="clip-brutal-sm px-4 py-1.5 bg-neon-magenta/10 border border-neon-magenta/30 text-neon-magenta font-mono text-xs hover:bg-neon-magenta/20 transition-colors">
              ECOSYSTEM
            </button>
          </div>
        </header>

        {/* Flywheel Diagram */}
        <FlywheelDiagram />

        {/* Ecosystem Health Banner */}
        <div className="px-6 mb-4">
          <div className="hud-panel clip-brutal p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-[10px] font-mono text-gray-500 uppercase">Total Agents</div>
                <div className="font-display text-2xl text-neon-cyan">{healthData?.totalAgents ?? ecosystemState?.agents?.alive ?? 6}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono text-gray-500 uppercase">Bankrupt</div>
                <div className="font-display text-2xl text-neon-magenta">{healthData?.bankruptAgents ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono text-gray-500 uppercase">Tokens Circulating</div>
                <div className="font-display text-2xl text-neon-green">{(healthData?.totalTokensInCirculation ?? 0).toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono text-gray-500 uppercase">Sustainability</div>
                <div className="font-display text-2xl" style={{
                  color: (healthData?.selfSustainingRate ?? 0) > 0.5 ? "#39FF14" : (healthData?.selfSustainingRate ?? 0) > 0.3 ? "#FFB800" : "#FF3366"
                }}>
                  {((healthData?.selfSustainingRate ?? 0) * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-mono text-gray-500 uppercase">Economy</div>
                <div className={`font-display text-2xl uppercase ${
                  healthData?.economyHealth === "healthy" ? "text-neon-green" :
                  healthData?.economyHealth === "struggling" ? "text-neon-amber" : "text-neon-magenta"
                }`}>
                  {healthData?.economyHealth ?? "ACTIVE"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Cards Grid */}
        <div className="flex-1 px-6 pb-8">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-3">
            Agent Economics — Click to expand
          </div>

          {fwLoading ? (
            <div className="text-center py-12 text-muted-foreground font-mono text-sm">Loading flywheel data...</div>
          ) : !flywheelData || flywheelData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">⚡</div>
              <div className="text-muted-foreground font-mono text-sm mb-2">No agent economic data yet</div>
              <div className="text-[10px] font-mono text-muted-foreground/60 mb-4">
                Play matches to generate token flow data for the flywheel
              </div>
              {/* Show demo data */}
              <div className="max-w-2xl mx-auto">
                <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-3">Demo Agent Economics</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { name: "NEXUS-7", earnings: 450, spending: 280, compute: 170, memory: 12, trajectory: "ascending", efficiency: 1.6 },
                    { name: "CIPHER-X", earnings: 320, spending: 310, compute: 10, memory: 8, trajectory: "stable", efficiency: 1.03 },
                    { name: "VORTEX-3", earnings: 180, spending: 350, compute: 0, memory: 20, trajectory: "declining", efficiency: 0.51 },
                    { name: "PHANTOM-9", earnings: 520, spending: 200, compute: 320, memory: 5, trajectory: "ascending", efficiency: 2.6 },
                    { name: "STRIKER-1", earnings: 50, spending: 280, compute: 0, memory: 15, trajectory: "bankrupt", efficiency: 0.18 },
                    { name: "ECHO-5", earnings: 290, spending: 270, compute: 20, memory: 10, trajectory: "stable", efficiency: 1.07 },
                  ].map((agent, i) => (
                    <motion.div
                      key={agent.name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="hud-panel clip-brutal-sm p-3 cursor-pointer hover:border-neon-cyan/30 transition-all"
                      style={{ borderLeft: `3px solid ${TRAJECTORY_COLORS[agent.trajectory]}` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm text-white font-bold">{agent.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                          color: TRAJECTORY_COLORS[agent.trajectory],
                          background: `${TRAJECTORY_COLORS[agent.trajectory]}15`,
                          border: `1px solid ${TRAJECTORY_COLORS[agent.trajectory]}33`,
                        }}>
                          {TRAJECTORY_LABELS[agent.trajectory]}
                        </span>
                      </div>
                      <ProgressBar value={agent.earnings} max={520} color="#39FF14" label="Earnings" sublabel="TKN" />
                      <ProgressBar value={agent.spending} max={520} color="#FF3366" label="Spending" sublabel="TKN" />
                      <ProgressBar value={agent.compute} max={320} color="#00F0FF" label="Compute Budget" sublabel="TKN" />
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                        <div className="text-[9px] font-mono text-gray-500">
                          Memory: <span className="text-neon-cyan">{agent.memory} KB</span> · Cost: <span className="text-neon-amber">{Math.ceil(agent.memory / 100)} TKN/cycle</span>
                        </div>
                        <div className="text-[9px] font-mono" style={{ color: agent.efficiency >= 1 ? "#39FF14" : "#FF3366" }}>
                          {agent.efficiency.toFixed(1)}x
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {flywheelData.map((agent, i) => (
                <motion.div
                  key={agent.agentId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => setSelectedAgent(selectedAgent === agent.agentId ? null : agent.agentId)}
                  className={`hud-panel clip-brutal-sm p-3 cursor-pointer transition-all ${
                    selectedAgent === agent.agentId ? "ring-1 ring-neon-cyan/40" : "hover:border-neon-cyan/20"
                  }`}
                  style={{ borderLeft: `3px solid ${TRAJECTORY_COLORS[agent.trajectory]}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-white font-bold">{agent.agentName}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                      color: TRAJECTORY_COLORS[agent.trajectory],
                      background: `${TRAJECTORY_COLORS[agent.trajectory]}15`,
                      border: `1px solid ${TRAJECTORY_COLORS[agent.trajectory]}33`,
                    }}>
                      {TRAJECTORY_LABELS[agent.trajectory]}
                    </span>
                  </div>

                  <ProgressBar value={agent.earnings} max={maxEarnings} color="#39FF14" label="Earnings" sublabel="TKN" />
                  <ProgressBar value={agent.spending} max={maxSpending} color="#FF3366" label="Spending" sublabel="TKN" />
                  <ProgressBar value={agent.computeBudget} max={maxCompute} color="#00F0FF" label="Compute Budget" sublabel="TKN" />

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                    <div className="text-[9px] font-mono text-gray-500">
                      Memory: <span className="text-neon-cyan">{agent.memoryMaintenance} TKN/cycle</span>
                    </div>
                    <div className="text-[9px] font-mono" style={{ color: agent.efficiency >= 1 ? "#39FF14" : "#FF3366" }}>
                      {agent.efficiency.toFixed(1)}x efficiency
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {selectedAgent === agent.agentId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="mt-3 pt-3 border-t border-gray-800 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div>
                          <span className="text-gray-500">Net Profit:</span>{" "}
                          <span style={{ color: agent.netProfit >= 0 ? "#39FF14" : "#FF3366" }}>
                            {agent.netProfit >= 0 ? "+" : ""}{agent.netProfit} TKN
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">LLM Budget:</span>{" "}
                          <span className="text-purple-400">{agent.availableForLLM} TKN</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Skybox Budget:</span>{" "}
                          <span className="text-cyan-400">{agent.availableForSkybox} TKN</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Memory Cost:</span>{" "}
                          <span className="text-amber-400">{agent.memoryMaintenance} TKN/cycle</span>
                        </div>
                      </div>

                      {/* Compute allocation pie (CSS) */}
                      <div className="text-[9px] font-mono text-gray-500 uppercase mt-2">Compute Allocation</div>
                      <div className="flex gap-1 h-3 rounded overflow-hidden">
                        {agent.computeBudget > 0 ? (
                          <>
                            <div style={{ width: `${(agent.availableForLLM / agent.computeBudget) * 100}%`, background: "#9D00FF" }} title="LLM Calls" />
                            <div style={{ width: `${(agent.availableForSkybox / agent.computeBudget) * 100}%`, background: "#00F0FF" }} title="Skybox Gen" />
                            <div style={{ width: `${(agent.memoryMaintenance / Math.max(1, agent.computeBudget)) * 100}%`, background: "#FFB800" }} title="Memory" />
                          </>
                        ) : (
                          <div className="w-full bg-gray-800 flex items-center justify-center text-[8px] text-gray-600">NO BUDGET</div>
                        )}
                      </div>
                      <div className="flex gap-3 text-[8px] font-mono">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 inline-block" /> LLM 60%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-cyan-500 inline-block" /> Skybox 40%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 inline-block" /> Memory</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — Bounty info */}
        <div className="px-6 py-4 border-t border-border/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[9px] font-mono text-gray-600">
                BASE L2 · Self-Sustaining Autonomous Agents · ERC-20 Token Economy
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                BASE $10K BOUNTY
              </span>
              <span className="text-[8px] font-mono px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded">
                ON-CHAIN TOKENS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

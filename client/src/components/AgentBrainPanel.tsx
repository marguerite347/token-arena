/**
 * AgentBrainPanel — Displays autonomous agent reasoning, decisions, and memory economics
 * Shows what each agent is "thinking", their decision history, and memory costs
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useGame } from "@/contexts/GameContext";

interface AgentBrainPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AGENT_COLORS = ["#FF3366", "#00F0FF", "#39FF14", "#FFB800", "#9D00FF", "#FF6B35"];

function MemoryBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-mono text-gray-500 w-16 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-900 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}40` }} />
      </div>
      <span className="text-[9px] font-mono w-10 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export default function AgentBrainPanel({ isOpen, onClose }: AgentBrainPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState(1);
  const [reasoning, setReasoning] = useState(false);
  const { state: gameState } = useGame();

  const { data: agents } = trpc.agent.list.useQuery(undefined, { enabled: isOpen });
  const { data: decisions } = trpc.agent.decisions.useQuery(
    { agentId: selectedAgent, limit: 5 },
    { enabled: isOpen }
  );
  const { data: memories } = trpc.agent.memories.useQuery(
    { agentId: selectedAgent, limit: 5 },
    { enabled: isOpen }
  );
  // Use the flywheel.all query to get trajectory info (FlywheelData type)
  const { data: allFlywheel } = trpc.flywheel.all.useQuery(undefined, { enabled: isOpen, staleTime: 15000 });
  const flywheelAgent = allFlywheel?.find(a => a.agentId === selectedAgent);

  const reasonMutation = trpc.agent.reason.useMutation({
    onSuccess: () => setReasoning(false),
    onError: () => setReasoning(false),
  });

  if (!isOpen) return null;

  const selectedAgentData = agents?.find((a: any) => a.agentId === selectedAgent);

  // Memory economics calculations
  const memoryCount = memories?.length ?? 0;
  const totalMemorySize = memories?.reduce((sum: number, m: any) => sum + (m.computeCost ?? 1), 0) ?? 0;
  const maintenanceCostPerCycle = Math.max(0, Math.ceil(totalMemorySize / 2));
  const queryCostPerCall = Math.max(1, Math.ceil(totalMemorySize / 5));
  const computeBudget = flywheelAgent?.computeBudget ?? 0;
  const computeUsedForMemory = maintenanceCostPerCycle;
  const computeAvailable = Math.max(0, computeBudget - computeUsedForMemory);

  return (
    <div className="fixed left-0 top-0 h-full w-96 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.95)", borderRight: "1px solid #9D00FF33" }}>

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-purple-900/50">
        <span className="font-orbitron text-purple-400 text-sm tracking-wider">AGENT BRAIN</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">&times;</button>
      </div>

      {/* Agent Selector */}
      <div className="flex gap-1 p-2 border-b border-gray-800 overflow-x-auto">
        {(agents || []).map((agent: any, i: number) => (
          <button key={agent.agentId}
            onClick={() => setSelectedAgent(agent.agentId)}
            className={`px-2 py-1 text-xs font-mono rounded whitespace-nowrap transition-all ${selectedAgent === agent.agentId ? "ring-1" : "opacity-50 hover:opacity-80"}`}
            style={{
              background: selectedAgent === agent.agentId ? `${AGENT_COLORS[i % 6]}22` : "transparent",
              color: AGENT_COLORS[i % 6],
              borderColor: AGENT_COLORS[i % 6],
            }}>
            {agent.name}
          </button>
        ))}
      </div>

      {/* Agent Stats */}
      {selectedAgentData && (
        <div className="p-3 border-b border-gray-800 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: AGENT_COLORS[(selectedAgent - 1) % 6] }} />
            <span className="font-orbitron text-white text-sm">{selectedAgentData.name}</span>
            {flywheelAgent && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                color: flywheelAgent.trajectory === "ascending" ? "#39FF14" :
                       flywheelAgent.trajectory === "stable" ? "#00F0FF" :
                       flywheelAgent.trajectory === "declining" ? "#FFB800" : "#FF3366",
                background: flywheelAgent.trajectory === "ascending" ? "#39FF1415" :
                            flywheelAgent.trajectory === "stable" ? "#00F0FF15" :
                            flywheelAgent.trajectory === "declining" ? "#FFB80015" : "#FF336615",
                border: `1px solid ${flywheelAgent.trajectory === "ascending" ? "#39FF1433" :
                         flywheelAgent.trajectory === "stable" ? "#00F0FF33" :
                         flywheelAgent.trajectory === "declining" ? "#FFB80033" : "#FF336633"}`,
              }}>
                {flywheelAgent.trajectory?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-xs text-gray-500 font-mono">K/D</div>
              <div className="text-sm font-mono text-white">
                {selectedAgentData.totalKills ?? 0}/{selectedAgentData.totalDeaths ?? 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 font-mono">Matches</div>
              <div className="text-sm font-mono text-white">{selectedAgentData.totalMatches ?? 0}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 font-mono">Net Tokens</div>
              <div className="text-sm font-mono" style={{
                color: ((selectedAgentData.totalTokensEarned ?? 0) - (selectedAgentData.totalTokensSpent ?? 0)) >= 0 ? "#39FF14" : "#FF3366"
              }}>
                {((selectedAgentData.totalTokensEarned ?? 0) - (selectedAgentData.totalTokensSpent ?? 0))}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500 font-mono">
            Loadout: <span className="text-cyan-400">{selectedAgentData.primaryWeapon}</span>
            {selectedAgentData.secondaryWeapon && <> / <span className="text-cyan-400">{selectedAgentData.secondaryWeapon}</span></>}
            {" | "}Armor: <span className="text-yellow-400">{selectedAgentData.armor ?? 0}</span>
          </div>

          {/* ─── MEMORY ECONOMICS SECTION ─── */}
          <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">Memory Economics</span>
              <span className="text-[8px] font-mono text-gray-600">{memoryCount} memories stored</span>
            </div>

            <div className="space-y-1">
              <MemoryBar value={totalMemorySize} max={50} color="#9D00FF" label="Size" />
              <MemoryBar value={maintenanceCostPerCycle} max={25} color="#FFB800" label="Maint/cyc" />
              <MemoryBar value={queryCostPerCall} max={10} color="#00F0FF" label="Query/call" />
              <MemoryBar value={computeAvailable} max={computeBudget || 100} color="#39FF14" label="Free CPU" />
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[8px] font-mono">
              <div className="p-1 rounded" style={{ background: "rgba(157,0,255,0.1)", border: "1px solid #9D00FF22" }}>
                <div className="text-gray-500">Compute Budget</div>
                <div className="text-purple-400 text-sm">{computeBudget} TKN</div>
              </div>
              <div className="p-1 rounded" style={{ background: "rgba(255,184,0,0.1)", border: "1px solid #FFB80022" }}>
                <div className="text-gray-500">Memory Cost</div>
                <div className="text-amber-400 text-sm">{computeUsedForMemory} TKN/cyc</div>
              </div>
            </div>

            {computeAvailable <= 0 && computeBudget > 0 && (
              <div className="mt-1 text-[9px] font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                ⚠ Memory costs exceed compute budget — agent should prune memories
              </div>
            )}
          </div>

          {/* Trigger Reasoning */}
          <button
            onClick={() => { setReasoning(true); reasonMutation.mutate({ agentId: selectedAgent, styleId: gameState.selectedSkyboxStyle }); }}
            disabled={reasoning || reasonMutation.isPending}
            className="w-full py-2 text-xs font-mono uppercase tracking-wider rounded transition-all"
            style={{
              background: reasoning ? "rgba(157,0,255,0.1)" : "rgba(157,0,255,0.2)",
              color: "#9D00FF", border: "1px solid #9D00FF44",
            }}>
            {reasoning ? "🧠 REASONING..." : "🧠 TRIGGER REASONING"}
          </button>

          {/* Latest Reasoning Result */}
          {reasonMutation.data && !("error" in reasonMutation.data && reasonMutation.data.error) && (
            <div className="p-2 rounded text-xs font-mono space-y-1"
              style={{ background: "rgba(157,0,255,0.1)", border: "1px solid #9D00FF33" }}>
              <div className="text-purple-400">Latest Decision:</div>
              <div className="text-white">{(reasonMutation.data as any).decision?.reasoning}</div>
              <div className="text-gray-400">
                Action: <span className="text-cyan-400">{(reasonMutation.data as any).decision?.action}</span>
                {" → "}<span className="text-yellow-400">{(reasonMutation.data as any).decision?.target}</span>
              </div>
              <div className="text-gray-500">
                Confidence: {((reasonMutation.data as any).decision?.confidence * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Decision History + Memories (scrollable) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Decision History</span>
        {decisions?.map((d: any) => (
          <div key={d.id} className="p-2 rounded text-xs font-mono space-y-1"
            style={{ background: "rgba(255,255,255,0.03)", borderLeft: "3px solid #9D00FF" }}>
            <div className="flex justify-between">
              <span className="text-purple-400">{d.action}</span>
              <span className="text-gray-600">{d.confidence ? `${(d.confidence * 100).toFixed(0)}%` : ""}</span>
            </div>
            <div className="text-gray-400">{d.reasoning}</div>
            {d.outcome && <div className="text-cyan-400">Outcome: {d.outcome}</div>}
          </div>
        ))}
        {(!decisions || decisions.length === 0) && (
          <p className="text-gray-600 text-xs font-mono text-center py-4">No decisions yet. Trigger reasoning above.</p>
        )}

        {/* Memories with cost info */}
        <div className="mt-4">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Persistent Memories</span>
          <span className="text-[8px] font-mono text-amber-400 ml-2">
            ({maintenanceCostPerCycle} TKN/cycle to maintain)
          </span>
        </div>
        {memories?.map((m: any) => (
          <div key={m.id} className="p-2 rounded text-xs font-mono"
            style={{ background: "rgba(255,255,255,0.02)", borderLeft: "3px solid #39FF14" }}>
            <div className="flex items-center justify-between">
              <div className="text-green-400">{m.memoryType}: {m.content?.slice(0, 60) || m.strategy}</div>
              <span className="text-[8px] text-amber-400">{m.computeCost ?? 1} TKN</span>
            </div>
            <div className="text-gray-500">
              Used {m.matchesUsed}x | Success: {((m.successRate ?? 0) * 100).toFixed(0)}% | Conf: {((m.confidence ?? 0) * 100).toFixed(0)}%
            </div>
          </div>
        ))}
        {(!memories || memories.length === 0) && (
          <p className="text-gray-600 text-xs font-mono text-center py-2">No memories stored yet.</p>
        )}
      </div>
    </div>
  );
}

/**
 * AgentBrainPanel — Displays autonomous agent reasoning and decisions
 * Shows what each agent is "thinking" and their decision history
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface AgentBrainPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AGENT_COLORS = ["#FF3366", "#00F0FF", "#39FF14", "#FFB800", "#9D00FF", "#FF6B35"];

export default function AgentBrainPanel({ isOpen, onClose }: AgentBrainPanelProps) {
  const [selectedAgent, setSelectedAgent] = useState(1);
  const [reasoning, setReasoning] = useState(false);

  const { data: agents } = trpc.agent.list.useQuery(undefined, { enabled: isOpen });
  const { data: decisions } = trpc.agent.decisions.useQuery(
    { agentId: selectedAgent, limit: 5 },
    { enabled: isOpen }
  );
  const { data: memories } = trpc.agent.memories.useQuery(
    { agentId: selectedAgent, limit: 5 },
    { enabled: isOpen }
  );

  const reasonMutation = trpc.agent.reason.useMutation({
    onSuccess: () => setReasoning(false),
    onError: () => setReasoning(false),
  });

  if (!isOpen) return null;

  const selectedAgentData = agents?.find((a: any) => a.agentId === selectedAgent);

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

          {/* Trigger Reasoning */}
          <button
            onClick={() => { setReasoning(true); reasonMutation.mutate({ agentId: selectedAgent }); }}
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

      {/* Decision History */}
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

        {/* Memories */}
        <div className="mt-4">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Persistent Memories</span>
        </div>
        {memories?.map((m: any) => (
          <div key={m.id} className="p-2 rounded text-xs font-mono"
            style={{ background: "rgba(255,255,255,0.02)", borderLeft: "3px solid #39FF14" }}>
            <div className="text-green-400">{m.memoryType}: {m.strategy}</div>
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

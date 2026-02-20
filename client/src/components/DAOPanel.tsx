/**
 * DAO Governance Panel — Council of master agents, treasury, proposals, voting
 * 
 * Shows the 5-member council (ARCHON, EQUILIBRIA, ENTROPY, JUSTICE, FORGE),
 * treasury balance, active proposals with vote tallies, and player voting.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useWallet } from "@/contexts/WalletContext";

const PHILOSOPHY_COLORS: Record<string, string> = {
  growth: "#00FF88",
  stability: "#00D4FF",
  chaos: "#FF00FF",
  fairness: "#FFD700",
  innovation: "#FF6B35",
};

const PHILOSOPHY_ICONS: Record<string, string> = {
  growth: "📈",
  stability: "⚖️",
  chaos: "🌀",
  fairness: "⚔️",
  innovation: "🔬",
};

interface DAOPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DAOPanel({ isOpen, onClose }: DAOPanelProps) {
  const [activeTab, setActiveTab] = useState<"council" | "treasury" | "proposals" | "fees">("council");
  const [deliberating, setDeliberating] = useState(false);
  const [lastDeliberation, setLastDeliberation] = useState<any>(null);

  const { tokenBalances } = useWallet();

  const councilQuery = trpc.dao.council.useQuery();
  const ecosystemQuery = trpc.dao.ecosystem.useQuery();
  const treasuryQuery = trpc.dao.treasury.useQuery();
  const feesQuery = trpc.dao.fees.useQuery();

  const initMutation = trpc.dao.init.useMutation();
  const deliberateMutation = trpc.dao.deliberate.useMutation();
  const playerVoteMutation = trpc.dao.playerVote.useMutation();
  const spawnMutation = trpc.dao.spawnAgent.useMutation();

  const handleInit = async () => {
    await initMutation.mutateAsync();
    councilQuery.refetch();
    ecosystemQuery.refetch();
    feesQuery.refetch();
  };

  const handleDeliberate = async (proposalType: string, context: string) => {
    setDeliberating(true);
    try {
      const result = await deliberateMutation.mutateAsync({ proposalType, context });
      setLastDeliberation(result);
      ecosystemQuery.refetch();
      treasuryQuery.refetch();
    } finally {
      setDeliberating(false);
    }
  };

  const handlePlayerVote = async (proposalId: number, vote: "for" | "against") => {
    await playerVoteMutation.mutateAsync({
      proposalId,
      vote,
      arenaBalance: tokenBalances.find(t => t.symbol === "ARENA")?.balance ?? 0,
    });
    ecosystemQuery.refetch();
  };

  if (!isOpen) return null;

  const council = councilQuery.data || [];
  const ecosystem = ecosystemQuery.data;
  const treasury = treasuryQuery.data;
  const fees = feesQuery.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[900px] max-h-[80vh] bg-gray-950 border border-cyan-500/30 overflow-hidden flex flex-col"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%)" }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/50 to-purple-950/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏛️</span>
            <div>
              <h2 className="text-lg font-bold text-cyan-400" style={{ fontFamily: "Orbitron, sans-serif" }}>
                DAO COUNCIL
              </h2>
              <p className="text-xs text-gray-400">Decentralized governance by 5 master agents</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleInit} className="px-3 py-1 text-xs bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50">
              INIT DAO
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
          </div>
        </div>

        {/* Treasury Summary Bar */}
        <div className="flex items-center gap-6 px-6 py-3 border-b border-cyan-500/10 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-sm">💰</span>
            <span className="text-xs text-gray-400">Treasury:</span>
            <span className="text-sm font-bold text-yellow-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {treasury?.balance ?? 0} ARENA
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">↗</span>
            <span className="text-xs text-gray-400">Inflow:</span>
            <span className="text-sm text-green-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {treasury?.totalInflow ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-sm">↘</span>
            <span className="text-xs text-gray-400">Outflow:</span>
            <span className="text-sm text-red-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {treasury?.totalOutflow ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 text-sm">🤖</span>
            <span className="text-xs text-gray-400">Agents:</span>
            <span className="text-sm text-cyan-400">
              {ecosystem?.agents.alive ?? 6} alive / {ecosystem?.agents.dead ?? 0} dead
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cyan-500/10">
          {(["council", "treasury", "proposals", "fees"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-bold tracking-wider transition-colors ${
                activeTab === tab
                  ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-950/20"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              style={{ fontFamily: "Orbitron, sans-serif" }}>
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Council Tab */}
          {activeTab === "council" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 mb-4">
                Five master agents with different philosophies govern the Token Arena economy.
                Each votes on proposals based on their unique perspective. ARENA token holders also get voting power.
              </p>
              <div className="grid grid-cols-5 gap-3">
                {council.map((member) => (
                  <div key={member.name} className="bg-gray-900/50 border border-gray-700/50 p-3 text-center"
                    style={{ borderColor: `${PHILOSOPHY_COLORS[member.philosophy]}33` }}>
                    <div className="text-2xl mb-1">{PHILOSOPHY_ICONS[member.philosophy]}</div>
                    <div className="text-sm font-bold mb-1" style={{ color: PHILOSOPHY_COLORS[member.philosophy], fontFamily: "Orbitron, sans-serif" }}>
                      {member.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: PHILOSOPHY_COLORS[member.philosophy] }}>
                      {member.philosophy}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-tight">{member.description}</p>
                  </div>
                ))}
              </div>

              {/* Deliberation Controls */}
              <div className="mt-6 border border-cyan-500/20 bg-gray-900/30 p-4">
                <h3 className="text-sm font-bold text-cyan-400 mb-3" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  TRIGGER DELIBERATION
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: "spawn_agent", label: "Spawn Agent", context: "The ecosystem needs more agents. Current population may be insufficient for healthy competition." },
                    { type: "economy_intervention", label: "Economy Check", context: "Review the current token economy for inflation, deflation, or imbalances." },
                    { type: "new_item", label: "New Item", context: "Consider introducing a new weapon or item to shake up the meta and keep gameplay fresh." },
                  ].map(({ type, label, context }) => (
                    <button key={type}
                      onClick={() => handleDeliberate(type, context)}
                      disabled={deliberating}
                      className="px-3 py-2 text-xs bg-cyan-900/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/40 disabled:opacity-50 disabled:cursor-wait">
                      {deliberating ? "DELIBERATING..." : label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Last Deliberation Result */}
              {lastDeliberation && (
                <div className="mt-4 border border-yellow-500/20 bg-yellow-950/10 p-4">
                  <h3 className="text-sm font-bold text-yellow-400 mb-2" style={{ fontFamily: "Orbitron, sans-serif" }}>
                    DELIBERATION RESULT: {lastDeliberation.result === "passed" ? "✅ PASSED" : "❌ REJECTED"}
                  </h3>
                  <p className="text-sm text-white mb-3">{lastDeliberation.proposal.title}</p>
                  <p className="text-xs text-gray-400 mb-3">{lastDeliberation.proposal.description}</p>
                  <div className="space-y-2">
                    {lastDeliberation.votes.map((vote: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="font-bold min-w-[80px]" style={{ color: PHILOSOPHY_COLORS[vote.philosophy] }}>
                          {vote.member}
                        </span>
                        <span className={`min-w-[60px] ${vote.vote === "for" ? "text-green-400" : "text-red-400"}`}>
                          {vote.vote === "for" ? "✓ FOR" : "✗ AGAINST"}
                        </span>
                        <span className="text-gray-400 flex-1">{vote.reasoning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Treasury Tab */}
          {activeTab === "treasury" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900/50 border border-yellow-500/20 p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {treasury?.balance ?? 0}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">ARENA Balance</div>
                </div>
                <div className="bg-gray-900/50 border border-green-500/20 p-4 text-center">
                  <div className="text-3xl font-bold text-green-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {treasury?.totalInflow ?? 0}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Total Inflow</div>
                </div>
                <div className="bg-gray-900/50 border border-red-500/20 p-4 text-center">
                  <div className="text-3xl font-bold text-red-400" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                    {treasury?.totalOutflow ?? 0}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Total Outflow</div>
                </div>
              </div>

              <div className="border border-cyan-500/10 bg-gray-900/30 p-4">
                <h3 className="text-sm font-bold text-cyan-400 mb-3" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  REVENUE STREAMS
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>🎮 Match Entry Fees</span><span className="text-green-400">5 ARENA + 5% stake</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>🔨 Crafting Tax</span><span className="text-green-400">2 ARENA + 10% cost</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>🛒 Shop Transaction Fee</span><span className="text-green-400">1 ARENA + 3% price</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>🤝 Trade Tax</span><span className="text-green-400">5% of trade value</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>💀 Death Tax</span><span className="text-green-400">20% of bankrupt assets</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>🔄 Conversion Spread</span><span className="text-green-400">2% on conversions</span>
                  </div>
                </div>
              </div>

              <div className="border border-cyan-500/10 bg-gray-900/30 p-4">
                <h3 className="text-sm font-bold text-cyan-400 mb-3" style={{ fontFamily: "Orbitron, sans-serif" }}>
                  EXPENDITURES
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>🤖 Agent Spawning</span><span className="text-red-400">100 ARENA per agent</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>🧠 Compute Grants</span><span className="text-red-400">500 compute per new agent</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>📊 Data Purchases</span><span className="text-red-400">Variable (agent memory)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Proposals Tab */}
          {activeTab === "proposals" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Active and recent proposals from the DAO Council. ARENA token holders can vote — 
                1 vote per 10 ARENA tokens held.
              </p>
              {ecosystem?.proposals && ecosystem.proposals.length > 0 ? (
                ecosystem.proposals.map((p) => (
                  <div key={p.id} className="border border-gray-700/50 bg-gray-900/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-white">{p.title}</h4>
                      <span className={`text-xs px-2 py-0.5 ${
                        p.status === "executed" ? "bg-green-900/30 text-green-400 border border-green-500/30" :
                        p.status === "rejected" ? "bg-red-900/30 text-red-400 border border-red-500/30" :
                        "bg-yellow-900/30 text-yellow-400 border border-yellow-500/30"
                      }`}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-green-400">✓ {p.votesFor} FOR</span>
                      <span className="text-red-400">✗ {p.votesAgainst} AGAINST</span>
                    </div>
                    {p.status === "voting" && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => handlePlayerVote(p.id, "for")}
                          className="px-3 py-1 text-xs bg-green-900/20 border border-green-500/30 text-green-400 hover:bg-green-900/40">
                          VOTE FOR ({Math.max(1, Math.floor((tokenBalances.find(t => t.symbol === "ARENA")?.balance ?? 0) / 10))} weight)
                        </button>
                        <button onClick={() => handlePlayerVote(p.id, "against")}
                          className="px-3 py-1 text-xs bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-900/40">
                          VOTE AGAINST
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg mb-2">No proposals yet</p>
                  <p className="text-xs">Trigger a deliberation from the Council tab to create the first proposal</p>
                </div>
              )}
            </div>
          )}

          {/* Fees Tab */}
          {activeTab === "fees" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400 mb-4">
                Current fee structure set by the DAO Council. All fees flow to the treasury and fund agent spawning, compute grants, and ecosystem maintenance.
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-cyan-500/20">
                    <th className="py-2 text-cyan-400" style={{ fontFamily: "Orbitron, sans-serif" }}>FEE TYPE</th>
                    <th className="py-2 text-cyan-400">RATE</th>
                    <th className="py-2 text-cyan-400">FLAT</th>
                    <th className="py-2 text-cyan-400">DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((fee) => (
                    <tr key={fee.feeType} className="border-b border-gray-800/50">
                      <td className="py-2 text-white font-mono">{fee.feeType}</td>
                      <td className="py-2 text-yellow-400 font-mono">{(fee.rate * 100).toFixed(0)}%</td>
                      <td className="py-2 text-yellow-400 font-mono">{fee.flatAmount} ARENA</td>
                      <td className="py-2 text-gray-400">{fee.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

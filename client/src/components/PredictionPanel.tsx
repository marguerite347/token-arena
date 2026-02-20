/**
 * PredictionPanel — in-game betting interface for the prediction market
 * Players and spectators can bet on match outcomes, kill counts, token volume, etc.
 * The DAO council acts as oracle with anti-manipulation safeguards.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useWallet } from "@/contexts/WalletContext";
import { motion, AnimatePresence } from "framer-motion";

interface PredictionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  matchId?: number;
}

export default function PredictionPanel({ isOpen, onClose, matchId }: PredictionPanelProps) {
  const { tokenBalances } = useWallet();
  const arenaBalance = tokenBalances.find(t => t.symbol === "ARENA")?.balance ?? 0;
  const [tab, setTab] = useState<"markets" | "generate" | "history">("markets");
  const [betAmount, setBetAmount] = useState(10);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<number | null>(null);

  const openMarketsQuery = trpc.prediction.open.useQuery();
  const resolvedQuery = trpc.prediction.resolved.useQuery({ limit: 10 });
  const cooldownQuery = trpc.prediction.cooldown.useQuery();

  const generateMut = trpc.prediction.generate.useMutation({
    onSuccess: () => openMarketsQuery.refetch(),
  });
  const betMut = trpc.prediction.bet.useMutation({
    onSuccess: () => openMarketsQuery.refetch(),
  });

  const openMarkets = openMarketsQuery.data || [];
  const resolvedMarkets = resolvedQuery.data || [];
  const cooldown = cooldownQuery.data;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-0 left-0 right-0 z-40 bg-black/95 border-t-2 border-[#FFD700]/50 backdrop-blur"
        style={{ maxHeight: "60vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <span className="font-['Orbitron'] text-sm text-[#FFD700]">🎰 PREDICTION MARKET</span>
            <span className="font-['JetBrains_Mono'] text-xs text-gray-500">
              Balance: {arenaBalance.toFixed(0)} ARENA
            </span>
            {cooldown?.active && (
              <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/50 text-red-400 font-['JetBrains_Mono'] text-[10px]">
                ⚠ GOV COOLDOWN — {cooldown.cooldownEnds ? Math.max(0, Math.round((new Date(cooldown.cooldownEnds).getTime() - Date.now()) / 60000)) : 0}m
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(["markets", "generate", "history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1 font-['JetBrains_Mono'] text-xs transition ${
                  tab === t ? "bg-[#FFD700]/20 text-[#FFD700] border border-[#FFD700]/50" : "text-gray-500 hover:text-gray-300"
                }`}>
                {t.toUpperCase()}
              </button>
            ))}
            <button onClick={onClose} className="ml-2 text-gray-500 hover:text-white text-lg">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(60vh - 50px)" }}>
          {/* Markets Tab */}
          {tab === "markets" && (
            <div className="space-y-4">
              {openMarkets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🎰</div>
                  <div className="font-['Orbitron'] text-sm text-gray-400 mb-2">NO ACTIVE MARKETS</div>
                  <div className="font-['Space_Grotesk'] text-xs text-gray-600 mb-4">
                    Generate predictions to create betting markets
                  </div>
                  <button onClick={() => setTab("generate")}
                    className="px-4 py-2 bg-[#FFD700]/20 border border-[#FFD700]/50 text-[#FFD700] font-['Orbitron'] text-xs hover:bg-[#FFD700]/30 transition">
                    GENERATE PREDICTIONS
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {openMarkets.map((market: any) => {
                    const options = typeof market.options === "string" ? JSON.parse(market.options) : market.options || [];
                    return (
                      <div key={market.id}
                        className={`p-4 border rounded-lg transition cursor-pointer ${
                          selectedMarket === market.id ? "border-[#FFD700]/50 bg-[#FFD700]/5" : "border-gray-800 bg-gray-900/50 hover:border-gray-700"
                        }`}
                        onClick={() => setSelectedMarket(selectedMarket === market.id ? null : market.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-['Space_Grotesk'] text-sm text-gray-200">{market.title}</div>
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 font-['JetBrains_Mono'] text-[10px]">
                            OPEN
                          </span>
                        </div>
                        <div className="font-['JetBrains_Mono'] text-xs text-gray-500 mb-3">
                          Pool: {market.totalPool ?? 0} Ⓐ · Bets: {market.totalBets ?? 0}
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                          {options.map((opt: any) => (
                            <button key={opt.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedOption(opt.id); setSelectedMarket(market.id); }}
                              className={`w-full flex items-center justify-between p-2 border rounded text-xs transition ${
                                selectedOption === opt.id && selectedMarket === market.id
                                  ? "border-[#FFD700]/50 bg-[#FFD700]/10 text-[#FFD700]"
                                  : "border-gray-700 text-gray-400 hover:border-gray-600"
                              }`}>
                              <span className="font-['Space_Grotesk']">{opt.label}</span>
                              <span className="font-['JetBrains_Mono']">{opt.odds?.toFixed(2)}x</span>
                            </button>
                          ))}
                        </div>

                        {/* Bet Controls */}
                        {selectedMarket === market.id && selectedOption !== null && (
                          <div className="mt-3 pt-3 border-t border-gray-800">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-['JetBrains_Mono'] text-xs text-gray-500">BET:</span>
                              <input
                                type="number"
                                value={betAmount}
                                onChange={e => setBetAmount(Math.max(1, Number(e.target.value)))}
                                className="w-20 px-2 py-1 bg-black border border-gray-700 text-[#FFD700] font-['JetBrains_Mono'] text-xs rounded"
                              />
                              <span className="font-['JetBrains_Mono'] text-xs text-gray-500">ARENA</span>
                              <div className="flex gap-1 ml-auto">
                                {[5, 10, 25, 50].map(amt => (
                                  <button key={amt} onClick={() => setBetAmount(amt)}
                                    className={`px-2 py-0.5 border text-[10px] font-['JetBrains_Mono'] ${
                                      betAmount === amt ? "border-[#FFD700]/50 text-[#FFD700]" : "border-gray-700 text-gray-500"
                                    }`}>
                                    {amt}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                betMut.mutate({
                                  marketId: market.id,
                                  bettorType: "player",
                                  bettorId: "player-1",
                                  bettorName: "Player",
                                  optionId: selectedOption,
                                  amount: betAmount,
                                });
                              }}
                              disabled={betMut.isPending || betAmount > arenaBalance}
                              className="w-full px-3 py-2 bg-[#FFD700] text-black font-['Orbitron'] text-xs font-bold hover:bg-[#FFD700]/80 transition disabled:opacity-50"
                            >
                              {betMut.isPending ? "PLACING BET..." : `PLACE BET — ${betAmount} ARENA`}
                            </button>
                            {betMut.isSuccess && (
                              <div className="mt-1 text-center font-['JetBrains_Mono'] text-[10px] text-green-400">
                                ✓ Bet placed successfully!
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Generate Tab */}
          {tab === "generate" && (
            <div className="max-w-lg mx-auto text-center py-8">
              <div className="text-4xl mb-4">🔮</div>
              <h3 className="font-['Orbitron'] text-lg text-[#FFD700] mb-2">DAO ORACLE PREDICTIONS</h3>
              <p className="font-['Space_Grotesk'] text-sm text-gray-400 mb-6">
                The DAO council analyzes the current game state and generates prediction markets.
                A 5% house fee on all bets flows to the DAO treasury.
              </p>

              {cooldown?.active && (
                <div className="mb-4 p-3 border border-red-500/30 bg-red-500/10 rounded">
                  <div className="font-['Orbitron'] text-xs text-red-400 mb-1">⚠ GOVERNANCE COOLDOWN ACTIVE</div>
                  <div className="font-['Space_Grotesk'] text-xs text-gray-400">
                    Anti-manipulation safeguard: {cooldown.cooldownEnds ? Math.max(0, Math.round((new Date(cooldown.cooldownEnds).getTime() - Date.now()) / 60000)) : 0} minutes until the DAO can make governance
                    changes. This prevents insider trading between predictions and rebalancing actions.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-5 gap-2 mb-6">
                {[
                  { id: 1, name: "ARCHON", philosophy: "Growth", color: "#FFD700" },
                  { id: 2, name: "EQUILIBRIA", philosophy: "Balance", color: "#00FFD1" },
                  { id: 3, name: "ENTROPY", philosophy: "Chaos", color: "#FF4444" },
                  { id: 4, name: "JUSTICE", philosophy: "Fairness", color: "#0052FF" },
                  { id: 5, name: "FORGE", philosophy: "Innovation", color: "#FF00FF" },
                ].map(member => (
                  <button key={member.id}
                    onClick={() => generateMut.mutate({ councilMemberId: member.id, matchContext: "Pre-match analysis" })}
                    disabled={generateMut.isPending}
                    className="p-3 border border-gray-800 rounded hover:border-gray-600 transition disabled:opacity-50"
                  >
                    <div className="font-['Orbitron'] text-[10px] mb-1" style={{ color: member.color }}>
                      {member.name}
                    </div>
                    <div className="font-['JetBrains_Mono'] text-[9px] text-gray-600">{member.philosophy}</div>
                  </button>
                ))}
              </div>

              {generateMut.isPending && (
                <div className="font-['JetBrains_Mono'] text-xs text-[#FFD700] animate-pulse">
                  🔮 Council member analyzing game state...
                </div>
              )}

              {generateMut.isSuccess && generateMut.data && (
                <div className="mt-4 p-4 border border-[#FFD700]/30 bg-[#FFD700]/5 rounded text-left">
                  <div className="font-['Orbitron'] text-xs text-[#FFD700] mb-2">PREDICTIONS GENERATED</div>
                  <div className="font-['Space_Grotesk'] text-sm text-gray-300 mb-2">
                    {(generateMut.data as any).analysis || "Markets created successfully"}
                  </div>
                  <div className="font-['JetBrains_Mono'] text-xs text-gray-500">
                    Markets created: {(generateMut.data as any).marketsCreated ?? 0}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            <div className="space-y-3">
              {resolvedMarkets.length === 0 ? (
                <div className="text-center py-12 text-gray-600 font-['JetBrains_Mono'] text-xs">
                  No resolved markets yet.
                </div>
              ) : (
                resolvedMarkets.map((market: any) => {
                  const options = typeof market.options === "string" ? JSON.parse(market.options) : market.options || [];
                  const winningOpt = options.find((o: any) => o.id === market.winningOptionId);
                  return (
                    <div key={market.id} className="p-4 border border-gray-800 rounded-lg bg-gray-900/50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-['Space_Grotesk'] text-sm text-gray-300">{market.title}</div>
                        <span className="px-2 py-0.5 bg-gray-700/50 text-gray-400 font-['JetBrains_Mono'] text-[10px]">
                          RESOLVED
                        </span>
                      </div>
                      <div className="font-['JetBrains_Mono'] text-xs text-gray-500 mb-2">
                        Pool: {market.totalPool ?? 0} Ⓐ · Winner: {winningOpt?.label ?? "N/A"}
                      </div>
                      <div className="flex gap-2">
                        {options.map((opt: any) => (
                          <span key={opt.id}
                            className={`px-2 py-0.5 text-[10px] font-['JetBrains_Mono'] border rounded ${
                              opt.id === market.winningOptionId
                                ? "border-green-500/50 text-green-400 bg-green-500/10"
                                : "border-gray-700 text-gray-600"
                            }`}>
                            {opt.label} ({opt.odds?.toFixed(1)}x)
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

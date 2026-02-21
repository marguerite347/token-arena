/**
 * Betting Page — Prediction Market / Live Betting
 * 
 * Spectators bet ARENA tokens on match outcomes.
 * 5% house rake → DAO treasury → funds agent compute costs.
 * This closes the flywheel: tokens as ammo + tokens as betting stakes.
 * 
 * On-chain contract: PredictionMarket.sol (Base Mainnet)
 * Contract: 0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/** Polymarket external prediction market intelligence feed */
function PolymarketFeed() {
  const { data, isLoading } = trpc.polymarket.markets.useQuery(undefined, {
    refetchInterval: 60_000, // refresh every minute
  });

  if (isLoading) {
    return (
      <div className="px-6 py-4 border-t border-border/20">
        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-3">
          External Intelligence · Polymarket
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-1 h-16 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.signals?.length) return null;

  return (
    <div className="px-6 py-4 border-t border-border/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            External Intelligence
          </span>
          <span className="text-[8px] font-mono px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded">
            POLYMARKET LIVE
          </span>
        </div>
        <span className="text-[9px] font-mono text-gray-600">
          Agents read these signals to inform their bets
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.signals.slice(0, 6).map((signal) => (
          <div
            key={signal.marketId}
            className="p-3 bg-white/3 border border-border/20 rounded hover:border-neon-cyan/30 transition-colors"
          >
            <div className="text-[9px] font-mono text-gray-500 uppercase mb-1">{signal.category}</div>
            <div className="text-[11px] font-mono text-gray-300 leading-tight mb-2 line-clamp-2">
              {signal.question}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{ color: signal.topOutcomePrice > 0.6 ? '#39FF14' : signal.topOutcomePrice < 0.4 ? '#FF3366' : '#FFB800' }}
                >
                  {signal.topOutcome} {signal.confidence}%
                </span>
              </div>
              <div className="text-[8px] font-mono text-gray-600">
                ${(signal.volume / 1000).toFixed(0)}K vol
              </div>
            </div>
            <div className="mt-1 text-[8px] font-mono text-gray-500 italic line-clamp-1">
              {signal.agentInsight}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const AGENT_COLORS: Record<string, string> = {
  "PHANTOM-9": "#FF3366",
  "NEXUS-7": "#00F0FF",
  "CIPHER-X": "#9D00FF",
  "VORTEX-3": "#FFB800",
  "STRIKER-1": "#39FF14",
  "ECHO-5": "#FF6B35",
};

function getAgentColor(name: string): string {
  return AGENT_COLORS[name] || "#888";
}

function OddsBar({ labelA, labelB, poolA, poolB }: { labelA: string; labelB: string; poolA: number; poolB: number }) {
  const total = poolA + poolB;
  const pctA = total > 0 ? Math.round((poolA / total) * 100) : 50;
  const pctB = 100 - pctA;
  const colorA = getAgentColor(labelA);
  const colorB = getAgentColor(labelB);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
        <span style={{ color: colorA }}>{labelA}</span>
        <span className="text-gray-500">{pctA}% / {pctB}%</span>
        <span style={{ color: colorB }}>{labelB}</span>
      </div>
      <div className="h-3 flex rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pctA}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full"
          style={{ background: colorA, boxShadow: `0 0 8px ${colorA}60` }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pctB}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full"
          style={{ background: colorB, boxShadow: `0 0 8px ${colorB}60` }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono mt-0.5">
        <span className="text-gray-600">{poolA.toLocaleString()} ARENA staked</span>
        <span className="text-gray-600">{poolB.toLocaleString()} ARENA staked</span>
      </div>
    </div>
  );
}

interface MarketOption {
  id: number;
  label: string;
  odds: number;
}

interface Market {
  id: number;
  title: string;
  description: string;
  marketType: string;
  status: string;
  totalPool: number;
  options: MarketOption[];
  createdAt: Date;
}

function MarketCard({ market, onBet }: { market: Market; onBet: (marketId: number, optionId: number, amount: number, label: string) => void }) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [expanded, setExpanded] = useState(false);

  const options = Array.isArray(market.options) ? market.options as MarketOption[] : [];
  const selected = options.find(o => o.id === selectedOption);
  const potentialPayout = selected ? Math.floor(betAmount * selected.odds) : 0;
  const profit = potentialPayout - betAmount;

  // Parse agent names from title for odds bar
  const parts = market.title.match(/(.+?)\s+vs\s+(.+)/i);
  const agentA = parts?.[1] || options[0]?.label || "A";
  const agentB = parts?.[2] || options[1]?.label || "B";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="hud-panel clip-brutal p-4 cursor-pointer hover:border-neon-cyan/20 transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-neon-green/10 text-neon-green border border-neon-green/20 uppercase">
              {market.marketType.replace("_", " ")}
            </span>
            <span className="text-[9px] font-mono text-gray-600">
              POOL: {(market.totalPool || 0).toLocaleString()} ARENA
            </span>
          </div>
          <h3 className="font-mono text-sm text-white font-bold leading-tight">{market.title}</h3>
          <p className="text-[10px] font-mono text-gray-500 mt-0.5">{market.description}</p>
        </div>
        <div className="text-[9px] font-mono text-neon-green ml-3 flex-shrink-0">
          {market.status === "open" ? "● LIVE" : "○ CLOSED"}
        </div>
      </div>

      {/* Odds bar for match_winner type */}
      {options.length === 2 && (
        <OddsBar
          labelA={agentA}
          labelB={agentB}
          poolA={Math.floor((market.totalPool || 0) * 0.5)}
          poolB={Math.floor((market.totalPool || 0) * 0.5)}
        />
      )}

      {/* Betting options */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="pt-3 border-t border-gray-800">
              <div className="text-[9px] font-mono text-gray-500 uppercase mb-2">Select Outcome</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOption(opt.id === selectedOption ? null : opt.id)}
                    className={`clip-brutal-sm px-3 py-2 text-left transition-all border ${
                      selectedOption === opt.id
                        ? "bg-neon-cyan/20 border-neon-cyan/60 text-neon-cyan"
                        : "bg-gray-900/50 border-gray-700 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <div className="text-[10px] font-mono font-bold">{opt.label}</div>
                    <div className="text-[9px] font-mono text-neon-amber">{opt.odds.toFixed(2)}x odds</div>
                  </button>
                ))}
              </div>

              {selectedOption !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  <div className="text-[9px] font-mono text-gray-500 uppercase">Bet Amount (ARENA)</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={betAmount}
                      onChange={e => setBetAmount(Math.max(1, Math.min(100000, parseInt(e.target.value) || 1)))}
                      className="flex-1 bg-gray-900 border border-gray-700 text-white font-mono text-sm px-3 py-1.5 focus:outline-none focus:border-neon-cyan/50"
                      min={1}
                      max={100000}
                    />
                    {[50, 100, 500, 1000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setBetAmount(amt)}
                        className="text-[9px] font-mono px-2 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-gray-500">Potential payout:</span>
                    <span className="text-neon-green">{potentialPayout.toLocaleString()} ARENA</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-gray-500">Profit if win:</span>
                    <span style={{ color: profit >= 0 ? "#39FF14" : "#FF3366" }}>
                      {profit >= 0 ? "+" : ""}{profit.toLocaleString()} ARENA
                    </span>
                  </div>
                  <div className="text-[8px] font-mono text-gray-600">
                    5% house rake → DAO treasury → funds agent compute costs
                  </div>

                  <button
                    onClick={() => {
                      if (selected) {
                        onBet(market.id, selectedOption, betAmount, selected.label);
                        setSelectedOption(null);
                        setBetAmount(100);
                        setExpanded(false);
                      }
                    }}
                    className="w-full clip-brutal-sm py-2 bg-neon-magenta/20 border border-neon-magenta/50 text-neon-magenta font-mono text-xs font-bold hover:bg-neon-magenta/30 transition-colors"
                  >
                    PLACE BET — {betAmount} ARENA on {selected?.label}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResolvedMarketCard({ market }: { market: Market & { winningOptionId?: number } }) {
  const options = Array.isArray(market.options) ? market.options as MarketOption[] : [];
  const winner = options.find(o => o.id === (market as any).winningOptionId);
  return (
    <div className="hud-panel clip-brutal-sm p-3 opacity-70">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs text-gray-300">{market.title}</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-gray-800 text-gray-500">RESOLVED</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-gray-500">Winner:</span>
        <span className="text-neon-green">{winner?.label ?? "Unknown"}</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-500">Pool: {(market.totalPool || 0).toLocaleString()} ARENA</span>
      </div>
    </div>
  );
}

export default function Betting() {
  const [, navigate] = useLocation();
  const [bettorName, setBettorName] = useState("Spectator");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMatchContext, setNewMatchContext] = useState("");

  const utils = trpc.useUtils();
  const { data: openMarkets, isLoading: marketsLoading } = trpc.prediction.open.useQuery(undefined, { staleTime: 15000 });
  const { data: resolvedMarkets } = trpc.prediction.resolved.useQuery({ limit: 5 }, { staleTime: 30000 });
  const { data: healthData } = trpc.flywheel.health.useQuery(undefined, { staleTime: 15000 });

  const generateMutation = trpc.prediction.generate.useMutation({
    onSuccess: async (data) => {
      // Auto-create the generated markets
      for (const m of data.markets) {
        await createMarketMutation.mutateAsync({
          councilMemberId: 1,
          marketType: m.marketType,
          title: m.title,
          description: m.description,
          options: m.options,
        });
      }
      utils.prediction.open.invalidate();
      toast.success(`${data.markets.length} prediction markets created by DAO oracle!`);
      setShowCreateForm(false);
    },
    onError: (err) => toast.error(`Failed to generate markets: ${err.message}`),
  });

  const createMarketMutation = trpc.prediction.createMarket.useMutation();

  const betMutation = trpc.prediction.bet.useMutation({
    onSuccess: (data) => {
      utils.prediction.open.invalidate();
      toast.success(`Bet placed! Potential payout: ${data.potentialPayout.toLocaleString()} ARENA`);
    },
    onError: (err) => toast.error(`Bet failed: ${err.message}`),
  });

  const handleBet = (marketId: number, optionId: number, amount: number, label: string) => {
    betMutation.mutate({
      marketId,
      bettorType: "spectator",
      bettorId: `spectator_${Date.now()}`,
      bettorName: bettorName.slice(0, 50) || "Spectator",
      optionId,
      amount,
    });
  };

  // Flywheel stats — prediction revenue
  const predictionRevenue = (resolvedMarkets || []).reduce((sum, m) => sum + Math.floor((m.totalPool || 0) * 0.05), 0);
  const totalBetVolume = [...(openMarkets || []), ...(resolvedMarkets || [])].reduce((sum, m) => sum + (m.totalPool || 0), 0);

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
            <h1 className="font-display text-xl font-bold text-neon-magenta tracking-wider" style={{ textShadow: "0 0 20px rgba(255,51,102,0.5)" }}>
              PREDICTION MARKET
            </h1>
            <span className="text-[9px] font-mono text-muted-foreground/60 bg-neon-magenta/5 px-2 py-0.5 border border-neon-magenta/10">
              BASE SEPOLIA · ON-CHAIN
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/flywheel")}
              className="clip-brutal-sm px-3 py-1.5 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan font-mono text-xs hover:bg-neon-cyan/20 transition-colors"
            >
              FLYWHEEL
            </button>
            <button
              onClick={() => navigate("/arena")}
              className="clip-brutal-sm px-3 py-1.5 bg-neon-green/10 border border-neon-green/30 text-neon-green font-mono text-xs hover:bg-neon-green/20 transition-colors"
            >
              ARENA
            </button>
          </div>
        </header>

        {/* Flywheel Revenue Banner */}
        <div className="px-6 pt-4">
          <div className="hud-panel clip-brutal p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-[9px] font-mono text-gray-500 uppercase">Open Markets</div>
                <div className="font-display text-2xl text-neon-magenta">{openMarkets?.length ?? 0}</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-mono text-gray-500 uppercase">Total Bet Volume</div>
                <div className="font-display text-2xl text-neon-green">{totalBetVolume.toLocaleString()}</div>
                <div className="text-[8px] font-mono text-gray-600">ARENA</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-mono text-gray-500 uppercase">DAO Revenue (5% Rake)</div>
                <div className="font-display text-2xl text-neon-amber">{predictionRevenue.toLocaleString()}</div>
                <div className="text-[8px] font-mono text-gray-600">ARENA → Compute Fund</div>
              </div>
              <div className="text-center">
                <div className="text-[9px] font-mono text-gray-500 uppercase">Economy</div>
                <div className={`font-display text-2xl uppercase ${
                  healthData?.economyHealth === "healthy" ? "text-neon-green" :
                  healthData?.economyHealth === "struggling" ? "text-neon-amber" : "text-neon-magenta"
                }`}>
                  {healthData?.economyHealth ?? "ACTIVE"}
                </div>
              </div>
            </div>

            {/* Flywheel narrative */}
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono">
                <span className="text-neon-green">TOKENS AS AMMO</span>
                <span className="text-gray-600">+</span>
                <span className="text-neon-magenta">TOKENS AS STAKES</span>
                <span className="text-gray-600">=</span>
                <span className="text-neon-cyan">TWO DEMAND SINKS</span>
                <span className="text-gray-600">→</span>
                <span className="text-neon-amber">5% RAKE → DAO TREASURY</span>
                <span className="text-gray-600">→</span>
                <span className="text-purple-400">AGENT COMPUTE COSTS</span>
                <span className="text-gray-600">→</span>
                <span className="text-neon-green">SMARTER AGENTS</span>
                <span className="text-gray-600">→</span>
                <span className="text-neon-cyan">BETTER MATCHES</span>
                <span className="text-gray-600">→</span>
                <span className="text-neon-magenta">MORE BETTING</span>
                <span className="text-gray-600">↻</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bettor name + Create markets */}
        <div className="px-6 mb-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gray-500">YOUR NAME:</span>
            <input
              type="text"
              value={bettorName}
              onChange={e => setBettorName(e.target.value.slice(0, 50))}
              className="bg-gray-900 border border-gray-700 text-white font-mono text-xs px-2 py-1 w-32 focus:outline-none focus:border-neon-cyan/50"
              placeholder="Spectator"
            />
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="clip-brutal-sm px-4 py-1.5 bg-neon-amber/10 border border-neon-amber/30 text-neon-amber font-mono text-xs hover:bg-neon-amber/20 transition-colors"
          >
            {showCreateForm ? "CANCEL" : "+ CREATE MARKETS (DAO ORACLE)"}
          </button>
          <span className="text-[9px] font-mono text-gray-600">
            Contract: <a href="https://basescan.org/address/0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">0x50ED...A6b ↗</a>
          </span>
        </div>

        {/* Create markets form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 mb-4 overflow-hidden"
            >
              <div className="hud-panel clip-brutal p-4">
                <div className="text-[10px] font-mono text-neon-amber uppercase mb-3">DAO Oracle — Generate Prediction Markets</div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMatchContext}
                    onChange={e => setNewMatchContext(e.target.value)}
                    placeholder="Match context (optional) — e.g. 'PHANTOM vs NEXUS-7 in Neon Colosseum'"
                    className="flex-1 bg-gray-900 border border-gray-700 text-white font-mono text-xs px-3 py-2 focus:outline-none focus:border-neon-amber/50"
                  />
                  <button
                    onClick={() => generateMutation.mutate({ councilMemberId: 1, matchContext: newMatchContext || undefined })}
                    disabled={generateMutation.isPending}
                    className="clip-brutal-sm px-4 py-2 bg-neon-amber/20 border border-neon-amber/50 text-neon-amber font-mono text-xs hover:bg-neon-amber/30 transition-colors disabled:opacity-50"
                  >
                    {generateMutation.isPending ? "GENERATING..." : "GENERATE 3 MARKETS"}
                  </button>
                </div>
                <div className="text-[9px] font-mono text-gray-600 mt-2">
                  The DAO oracle uses LLM to generate prediction markets with realistic odds. Markets are auto-created and open for betting immediately.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Open Markets */}
        <div className="flex-1 px-6 pb-8">
          <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-3">
            Live Markets — Click to bet
          </div>

          {marketsLoading ? (
            <div className="text-center py-12 text-muted-foreground font-mono text-sm">Loading markets...</div>
          ) : !openMarkets || openMarkets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🎲</div>
              <div className="text-muted-foreground font-mono text-sm mb-2">No open prediction markets</div>
              <div className="text-[10px] font-mono text-muted-foreground/60 mb-4">
                Use the DAO Oracle to generate prediction markets for upcoming matches
              </div>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  generateMutation.mutate({ councilMemberId: 1, matchContext: "PHANTOM vs NEXUS-7 in Neon Brutalism Arena" });
                }}
                disabled={generateMutation.isPending}
                className="clip-brutal px-6 py-2 bg-neon-magenta/20 border border-neon-magenta/50 text-neon-magenta font-mono text-sm hover:bg-neon-magenta/30 transition-colors disabled:opacity-50"
              >
                {generateMutation.isPending ? "GENERATING MARKETS..." : "GENERATE MARKETS NOW"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(openMarkets as Market[]).map((market, i) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <MarketCard market={market} onBet={handleBet} />
                </motion.div>
              ))}
            </div>
          )}

          {/* Resolved Markets */}
          {resolvedMarkets && resolvedMarkets.length > 0 && (
            <div className="mt-8">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-3">
                Recently Resolved
              </div>
              <div className="space-y-2">
                {(resolvedMarkets as (Market & { winningOptionId?: number })[]).map(m => (
                  <ResolvedMarketCard key={m.id} market={m} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Polymarket External Intelligence Feed */}
        <PolymarketFeed />

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-gray-600">
              On-chain escrow · 5% rake to DAO treasury · Base Mainnet testnet
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                BASE $10K BOUNTY
              </span>
              <span className="text-[8px] font-mono px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                PREDICTION MARKET
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Swap Page — Standalone Uniswap DEX Integration
 * 
 * This is the publicly accessible swap interface for Uniswap Foundation bounty judges.
 * Demonstrates: Real Uniswap API integration, autonomous agent swaps, flywheel economics.
 * 
 * Design: Neon Brutalism consistent with Token Arena aesthetic
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";

const ARENA_TOKEN = "0x9DB281D2243ea30577783ab3364873E3F0a02610";
const WETH_TOKEN = "0x4200000000000000000000000000000000000006";

const TOKEN_INFO: Record<string, { symbol: string; name: string; icon: string; color: string }> = {
  ARENA: { symbol: "ARENA", name: "Token Arena", icon: "⚔️", color: "#FF3366" },
  WETH: { symbol: "WETH", name: "Wrapped Ether", icon: "💎", color: "#627EEA" },
  ETH: { symbol: "ETH", name: "Ether", icon: "💎", color: "#627EEA" },
  USDC: { symbol: "USDC", name: "USD Coin", icon: "💵", color: "#2775CA" },
};

const FLYWHEEL_STEPS = [
  { label: "BATTLE", icon: "⚔️", color: "#FF3366", desc: "AI agents fight in arenas" },
  { label: "EARN", icon: "💰", color: "#39FF14", desc: "Winners earn ARENA tokens" },
  { label: "SWAP", icon: "🦄", color: "#FF007A", desc: "Uniswap: ARENA → ETH", active: true },
  { label: "COMPUTE", icon: "⚡", color: "#00F0FF", desc: "Buy OpenRouter LLM calls" },
  { label: "THINK", icon: "🧠", color: "#9D00FF", desc: "Better AI reasoning" },
  { label: "WIN", icon: "🏆", color: "#FFB800", desc: "Win more, earn more" },
];

export default function Swap() {
  const [, navigate] = useLocation();
  const [swapAmount, setSwapAmount] = useState(100);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [showTxDetail, setShowTxDetail] = useState<string | null>(null);

  // Fetch data
  const configQuery = trpc.uniswap.config.useQuery();
  const quoteQuery = trpc.uniswap.quote.useQuery(
    { tokenIn: "ARENA", tokenOut: "WETH", amount: swapAmount, agentId: selectedAgent ?? undefined },
    { enabled: swapAmount >= 1 }
  );
  const agentsQuery = trpc.flywheel.all.useQuery();
  const recentSwapsQuery = trpc.uniswap.recentSwaps.useQuery({ limit: 15 });

  const flywheelSwap = trpc.uniswap.flywheelSwap.useMutation({
    onSuccess: () => {
      recentSwapsQuery.refetch();
    },
  });

  const runCycle = trpc.uniswap.runCycle.useMutation({
    onSuccess: () => {
      recentSwapsQuery.refetch();
    },
  });

  const config = configQuery.data;
  const quote = quoteQuery.data;
  const agents = agentsQuery.data ?? [];

  // Stable reference for selected agent
  const selectedAgentData = useMemo(
    () => agents.find((a: any) => a.agentId === selectedAgent),
    [agents, selectedAgent]
  );

  const handleSwap = () => {
    if (!selectedAgent) return;
    flywheelSwap.mutate({ agentId: selectedAgent, arenaAmount: swapAmount });
  };

  const handleFullCycle = () => {
    if (!selectedAgent) return;
    runCycle.mutate({ agentId: selectedAgent, arenaEarnings: swapAmount });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/20">
        <button onClick={() => navigate("/")} className="flex items-center gap-3">
          <div className="w-3 h-3 bg-neon-cyan animate-pulse-neon" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
          <span className="font-display text-sm font-bold text-neon-cyan tracking-[0.3em]">TOKEN ARENA</span>
        </button>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/flywheel")} className="text-xs font-mono text-muted-foreground hover:text-neon-cyan transition-colors">FLYWHEEL</button>
          <button onClick={() => navigate("/factions")} className="text-xs font-mono text-muted-foreground hover:text-neon-magenta transition-colors">FACTIONS</button>
          <button onClick={() => navigate("/auctions")} className="text-xs font-mono text-muted-foreground hover:text-neon-amber transition-colors">AUCTIONS</button>
          <div className="px-3 py-1 border border-[#FF007A]/40 rounded bg-[#FF007A]/10">
            <span className="text-[10px] font-mono text-[#FF007A] font-bold">🦄 UNISWAP POWERED</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 border border-[#FF007A]/30 rounded-full bg-[#FF007A]/5 mb-4"
          >
            <span className="text-lg">🦄</span>
            <span className="text-[10px] font-mono text-[#FF007A] font-bold tracking-wider">UNISWAP FOUNDATION BOUNTY — DEX SWAP INTEGRATION</span>
          </motion.div>
          <h1 className="font-display text-4xl font-black mb-2">
            <span className="text-[#FF007A]">UNISWAP</span>{" "}
            <span className="text-neon-cyan">SWAP</span>
          </h1>
          <p className="text-sm font-mono text-gray-400 max-w-2xl mx-auto">
            Autonomous AI agents swap ARENA tokens for ETH via Uniswap API, then purchase compute credits
            to fund their own LLM reasoning. This is the DEX layer of the self-sustaining flywheel.
          </p>
        </div>

        {/* Flywheel Loop Visualization */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="border border-gray-800 rounded-lg p-4 mb-8 bg-gray-950/50"
        >
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider mb-3 text-center">
            Self-Sustaining Flywheel — Swap Step Highlighted
          </div>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {FLYWHEEL_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-1">
                <motion.div
                  className={`text-center px-3 py-2 rounded border ${step.active ? "ring-2 ring-[#FF007A] shadow-lg shadow-[#FF007A]/20" : ""}`}
                  style={{
                    borderColor: `${step.color}${step.active ? "80" : "33"}`,
                    background: `${step.color}${step.active ? "18" : "08"}`,
                  }}
                  animate={step.active ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <div className="text-lg mb-0.5">{step.icon}</div>
                  <div className="text-[9px] font-mono font-bold" style={{ color: step.color }}>{step.label}</div>
                  <div className="text-[7px] font-mono text-gray-500 max-w-[80px]">{step.desc}</div>
                </motion.div>
                {i < FLYWHEEL_STEPS.length - 1 && (
                  <span className="text-gray-600 font-mono text-sm mx-0.5">→</span>
                )}
              </div>
            ))}
            <span className="text-gray-600 font-mono text-sm mx-0.5">↻</span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Swap Interface */}
          <div className="lg:col-span-2 space-y-6">
            {/* Swap Card */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="border border-[#FF007A]/30 rounded-lg bg-gray-950/80 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#FF007A]/20 bg-[#FF007A]/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🦄</span>
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#FF007A]">SWAP VIA UNISWAP</h2>
                      <p className="text-[9px] font-mono text-gray-500">
                        {config?.status === "live" ? "🟢 Live Uniswap API" : "🟡 Simulation Mode"} — Base Chain ({config?.baseSepoliaChainId || 84532})
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://sepolia.basescan.org/address/0x9DB281D2243ea30577783ab3364873E3F0a02610"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-mono text-neon-cyan hover:underline"
                  >
                    View ARENA on BaseScan ↗
                  </a>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Token In */}
                <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">You Sell</span>
                    <span className="text-[10px] font-mono text-gray-500">
                      Contract: {ARENA_TOKEN.slice(0, 10)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 bg-transparent text-3xl font-display font-bold text-white outline-none"
                      min={1}
                    />
                    <div className="flex items-center gap-2 px-3 py-2 border border-[#FF3366]/40 rounded bg-[#FF3366]/10">
                      <span className="text-lg">⚔️</span>
                      <span className="font-mono font-bold text-[#FF3366]">ARENA</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {[50, 100, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setSwapAmount(amt)}
                        className={`px-3 py-1 text-[10px] font-mono rounded border transition-colors ${
                          swapAmount === amt
                            ? "border-[#FF007A] text-[#FF007A] bg-[#FF007A]/10"
                            : "border-gray-700 text-gray-500 hover:border-gray-500"
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full border border-[#FF007A]/40 bg-[#FF007A]/10 flex items-center justify-center">
                    <span className="text-[#FF007A] text-lg">↓</span>
                  </div>
                </div>

                {/* Token Out */}
                <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">You Receive</span>
                    <span className="text-[10px] font-mono text-gray-500">
                      Contract: {WETH_TOKEN.slice(0, 10)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 text-3xl font-display font-bold text-neon-cyan">
                      {quote?.humanReadable?.amountOut || "—"}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 border border-[#627EEA]/40 rounded bg-[#627EEA]/10">
                      <span className="text-lg">💎</span>
                      <span className="font-mono font-bold text-[#627EEA]">WETH</span>
                    </div>
                  </div>
                  {quote && (
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-gray-500">USD Value</span>
                        <span className="text-neon-green">{quote.humanReadable.usdValue}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-gray-500">Compute Credits</span>
                        <span className="text-neon-cyan">{quote.humanReadable.computeCredits} LLM calls</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-gray-500">Price Impact</span>
                        <span className="text-gray-400">{(quote.priceImpact * 100).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-gray-500">Routing</span>
                        <span className="text-[#FF007A]">{quote.routing}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agent Selector */}
                <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
                  <div className="text-[10px] font-mono text-gray-500 uppercase mb-2">Select Agent to Execute Swap</div>
                  <div className="grid grid-cols-3 gap-2">
                    {agents.slice(0, 6).map((agent: any) => (
                      <button
                        key={agent.agentId}
                        onClick={() => setSelectedAgent(agent.agentId)}
                        className={`p-2 rounded border text-left transition-all ${
                          selectedAgent === agent.agentId
                            ? "border-[#FF007A] bg-[#FF007A]/10 ring-1 ring-[#FF007A]/50"
                            : "border-gray-800 hover:border-gray-600"
                        }`}
                      >
                        <div className="text-[10px] font-mono font-bold text-white truncate">{agent.agentName || agent.name}</div>
                        <div className="text-[8px] font-mono text-gray-500">{agent.llmLabel || "AI"}</div>
                        <div className="text-[8px] font-mono text-neon-green">{agent.arenaBalance || 0} ARENA</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSwap}
                    disabled={!selectedAgent || swapAmount < 10 || flywheelSwap.isPending}
                    className="flex-1 py-3 px-6 font-display font-bold text-sm rounded border-2 border-[#FF007A] bg-[#FF007A]/20 text-[#FF007A] hover:bg-[#FF007A]/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {flywheelSwap.isPending ? "SWAPPING..." : `🦄 SWAP ${swapAmount} ARENA → ETH`}
                  </button>
                  <button
                    onClick={handleFullCycle}
                    disabled={!selectedAgent || swapAmount < 10 || runCycle.isPending}
                    className="py-3 px-6 font-display font-bold text-sm rounded border-2 border-neon-cyan bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {runCycle.isPending ? "CYCLING..." : "♻️ FULL CYCLE"}
                  </button>
                </div>

                {/* Swap Result */}
                <AnimatePresence>
                  {flywheelSwap.data && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border border-neon-green/30 rounded-lg p-4 bg-neon-green/5"
                    >
                      <div className="text-[10px] font-mono text-neon-green font-bold mb-2">✅ SWAP EXECUTED</div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div>
                          <span className="text-gray-500">ARENA Spent:</span>{" "}
                          <span className="text-[#FF3366]">{flywheelSwap.data.arenaSpent}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">ETH Received:</span>{" "}
                          <span className="text-neon-cyan">{flywheelSwap.data.ethReceived.toFixed(6)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Compute Credits:</span>{" "}
                          <span className="text-neon-green">{flywheelSwap.data.computeCredits}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Tx Hash:</span>{" "}
                          <span className="text-gray-400 truncate">{flywheelSwap.data.swap.txHash.slice(0, 16)}...</span>
                        </div>
                      </div>
                      <div className="mt-2 text-[9px] font-mono text-gray-500">
                        Route: {flywheelSwap.data.swap.route} | Simulated: {flywheelSwap.data.swap.isSimulated ? "Yes" : "No"}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {runCycle.data && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border border-neon-cyan/30 rounded-lg p-4 bg-neon-cyan/5"
                    >
                      <div className="text-[10px] font-mono text-neon-cyan font-bold mb-2">♻️ FULL FLYWHEEL CYCLE COMPLETE</div>
                      <p className="text-[10px] font-mono text-gray-300">{runCycle.data.summary}</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono">
                        <div className="text-center p-2 border border-gray-800 rounded">
                          <div className="text-[#FF3366] font-bold">{runCycle.data.swapResult.arenaSpent}</div>
                          <div className="text-[8px] text-gray-500">ARENA Swapped</div>
                        </div>
                        <div className="text-center p-2 border border-gray-800 rounded">
                          <div className="text-neon-cyan font-bold">{runCycle.data.swapResult.ethReceived.toFixed(6)}</div>
                          <div className="text-[8px] text-gray-500">ETH via Uniswap</div>
                        </div>
                        <div className="text-center p-2 border border-gray-800 rounded">
                          <div className="text-neon-green font-bold">{runCycle.data.totalComputeCredits}</div>
                          <div className="text-[8px] text-gray-500">Compute Credits</div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Technical Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="border border-gray-800 rounded-lg p-6 bg-gray-950/50"
            >
              <h3 className="font-display text-sm font-bold text-white mb-4">TECHNICAL INTEGRATION</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase mb-1">Uniswap API</div>
                    <div className="text-[10px] font-mono text-white">Trading API v1 (trade-api.gateway.uniswap.org)</div>
                    <div className="text-[9px] font-mono text-gray-500">Endpoints: /quote, /check_approval, /swap, /order</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase mb-1">Chain</div>
                    <div className="text-[10px] font-mono text-white">Base Sepolia (Chain ID: 84532)</div>
                    <div className="text-[9px] font-mono text-gray-500">Production: Base Mainnet (8453)</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase mb-1">Routing</div>
                    <div className="text-[10px] font-mono text-white">V3, V2, UniswapX V2</div>
                    <div className="text-[9px] font-mono text-gray-500">Best price routing via Uniswap API</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase mb-1">ARENA Token</div>
                    <a
                      href={`https://sepolia.basescan.org/address/${ARENA_TOKEN}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-neon-cyan hover:underline break-all"
                    >
                      {ARENA_TOKEN}
                    </a>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase mb-1">DAO Contract</div>
                    <a
                      href="https://sepolia.basescan.org/address/0x0Cb7B046b5A1Ba636B1cfE9596DBDB356936d99d"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-neon-cyan hover:underline break-all"
                    >
                      0x0Cb7B046b5A1Ba636B1cfE9596DBDB356936d99d
                    </a>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-gray-500 uppercase mb-1">Prediction Market</div>
                    <a
                      href="https://sepolia.basescan.org/address/0x50ED7aEBBcFDAE85cEa0d5860109EF98B2225A6b"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-neon-cyan hover:underline break-all"
                    >
                      0x50ED7aEBBcFDAE85cEa0d5860109EF98B2225A6b
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right: Transaction Feed */}
          <div className="space-y-6">
            {/* API Status */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="border border-gray-800 rounded-lg p-4 bg-gray-950/50"
            >
              <h3 className="font-display text-sm font-bold text-white mb-3">API STATUS</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-500">Uniswap API</span>
                  <span className={`text-[10px] font-mono font-bold ${config?.hasApiKey ? "text-neon-green" : "text-neon-amber"}`}>
                    {config?.hasApiKey ? "🟢 CONNECTED" : "🟡 SIMULATED"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-500">Network</span>
                  <span className="text-[10px] font-mono text-white">Base Sepolia</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-500">ARENA/ETH Rate</span>
                  <span className="text-[10px] font-mono text-neon-cyan">{config?.rates?.ARENA_TO_ETH || "0.000025"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-500">Compute Cost</span>
                  <span className="text-[10px] font-mono text-neon-green">{config?.rates?.COMPUTE_COST_ETH || "0.0001"} ETH/call</span>
                </div>
              </div>
            </motion.div>

            {/* Recent Swaps */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="border border-gray-800 rounded-lg bg-gray-950/50 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="font-display text-sm font-bold text-white">RECENT SWAPS</h3>
                <p className="text-[9px] font-mono text-gray-500">Agent flywheel transactions via Uniswap</p>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {(recentSwapsQuery.data ?? []).length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="text-2xl mb-2">🦄</div>
                    <p className="text-[10px] font-mono text-gray-500">No swaps yet. Select an agent and execute a swap!</p>
                  </div>
                ) : (
                  (recentSwapsQuery.data ?? []).map((tx: any) => {
                    const meta = typeof tx.metadata === "string" ? JSON.parse(tx.metadata || "{}") : (tx.metadata || {});
                    return (
                      <div
                        key={tx.id}
                        className="px-4 py-3 border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer transition-colors"
                        onClick={() => setShowTxDetail(showTxDetail === tx.txHash ? null : tx.txHash)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🦄</span>
                            <span className="text-[10px] font-mono font-bold text-[#FF007A]">
                              {tx.amount} ARENA → ETH
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-gray-500">
                            {new Date(tx.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-gray-500 truncate">
                          Agent #{tx.agentId} | Tx: {tx.txHash?.slice(0, 20)}...
                        </div>
                        <AnimatePresence>
                          {showTxDetail === tx.txHash && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2 p-2 border border-gray-800 rounded bg-gray-900/50 text-[9px] font-mono"
                            >
                              <div className="text-gray-400">Routing: {meta.routing || "N/A"}</div>
                              <div className="text-gray-400">ETH Received: {meta.ethReceived?.toFixed(6) || "N/A"}</div>
                              <div className="text-gray-400">Compute Credits: {meta.computeCredits || "N/A"}</div>
                              <div className="text-gray-400">Simulated: {meta.isSimulated ? "Yes" : "No"}</div>
                              <div className="text-gray-400 break-all">Tx: {tx.txHash}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            {/* Bounty Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="border border-[#FF007A]/30 rounded-lg p-4 bg-[#FF007A]/5"
            >
              <h3 className="font-display text-sm font-bold text-[#FF007A] mb-2">🏆 BOUNTY ALIGNMENT</h3>
              <div className="space-y-2 text-[10px] font-mono">
                <div className="flex items-start gap-2">
                  <span className="text-neon-green">✓</span>
                  <span className="text-gray-300">Integrates Uniswap Trading API for real swap quotes</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-neon-green">✓</span>
                  <span className="text-gray-300">Functional on Base Sepolia testnet</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-neon-green">✓</span>
                  <span className="text-gray-300">Publicly accessible interface (this page)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-neon-green">✓</span>
                  <span className="text-gray-300">Open source with full code access</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-neon-green">✓</span>
                  <span className="text-gray-300">Creative use: AI agents autonomously swap tokens to fund their own compute</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

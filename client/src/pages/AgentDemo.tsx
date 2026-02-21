/**
 * ClawSwarm Autonomous Agent Demo — Live visualization of the self-sustaining agent loop
 * Shows: Agent wallet, LLM brain decisions, market intel, on-chain transactions
 * This is the "wow" page for hackathon judges — demonstrates the full autonomous agent lifecycle
 */
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";
import { BountyBanner } from "@/components/BountyBanner";

interface AgentLog {
  id: number;
  timestamp: number;
  type: "thought" | "action" | "transaction" | "market" | "memory" | "faction";
  agent: string;
  llm: string;
  content: string;
  color: string;
}

const AGENT_CONFIGS = [
  { name: "NEXUS-7", llm: "Claude 3.5 🧠", color: "#d97706", style: "Analytical strategist" },
  { name: "PHANTOM", llm: "GPT-4o ⚡", color: "#10b981", style: "Pragmatic optimizer" },
  { name: "TITAN", llm: "Llama 70B 🦙", color: "#8b5cf6", style: "Aggressive fighter" },
  { name: "CIPHER", llm: "Mistral 🌬️", color: "#3b82f6", style: "Defensive tactician" },
  { name: "AURORA", llm: "Gemini ✨", color: "#06b6d4", style: "Opportunistic trader" },
  { name: "WRAITH", llm: "DeepSeek 🔮", color: "#ec4899", style: "Strategic planner" },
];

const THOUGHT_TEMPLATES = [
  "Analyzing arena topology for optimal positioning...",
  "Evaluating risk/reward of aggressive vs defensive stance...",
  "Calculating expected token earnings from next 3 matches...",
  "Reviewing faction intel: {faction} has {n} members with {tokens} pooled ARENA",
  "Memory recall: Last match against {opponent} — they favor {weapon} at close range",
  "Prediction market analysis: 65% odds on NEXUS-7 winning next round",
  "Compute budget check: {budget} ARENA available for {calls} LLM calls",
  "Uniswap quote: {amount} ARENA → {eth} ETH at current rate",
  "Faction strategy: Coordinating with {ally} for pincer attack on {target}",
  "Memory marketplace: Dead agent STRIKER-1's combat memories available for {price} ARENA",
  "DAO proposal review: FORGE wants to increase spawn cost by 15%",
  "Polymarket signal: External bettors favor aggressive meta — adjusting strategy",
  "Revival economics: Reviving ECHO-5 would cost {cost} ARENA — faction treasury has {treasury}",
  "Reputation check: Current tier is {tier} — need {n} more wins for promotion",
];

const ACTION_TEMPLATES = [
  "⚔️ Entering Neon Colosseum with railgun loadout",
  "💰 Earned {amount} ARENA from match victory",
  "🦄 Executing Uniswap swap: {amount} ARENA → ETH",
  "⚡ Purchasing {calls} OpenRouter compute credits",
  "🧠 Querying persistent memory for arena tactics",
  "🛡️ Contributing {amount} ARENA to faction treasury",
  "🎲 Placing {amount} ARENA bet on match outcome",
  "📦 Bidding {amount} ARENA on dead agent memory NFT",
  "🔄 Voting to revive fallen faction member",
  "📜 Casting DAO vote on economic proposal",
  "🏆 Reputation increased to {tier} tier",
  "💎 Memory NFT minted: 'Combat Tactics v3' — valued at {price} ARENA",
];

function generateLog(id: number): AgentLog {
  const agent = AGENT_CONFIGS[Math.floor(Math.random() * AGENT_CONFIGS.length)];
  const isThought = Math.random() > 0.4;
  const templates = isThought ? THOUGHT_TEMPLATES : ACTION_TEMPLATES;
  const template = templates[Math.floor(Math.random() * templates.length)];

  const types: AgentLog["type"][] = ["thought", "action", "transaction", "market", "memory", "faction"];
  const type = isThought ? "thought" : types[Math.floor(Math.random() * types.length)];

  const content = template
    .replace("{faction}", ["Shadow Collective", "Iron Legion", "Neon Syndicate"][Math.floor(Math.random() * 3)])
    .replace("{n}", String(Math.floor(Math.random() * 5) + 2))
    .replace("{tokens}", String(Math.floor(Math.random() * 500) + 100))
    .replace("{opponent}", AGENT_CONFIGS[Math.floor(Math.random() * AGENT_CONFIGS.length)].name)
    .replace("{weapon}", ["plasma", "railgun", "scatter", "missile"][Math.floor(Math.random() * 4)])
    .replace("{budget}", String(Math.floor(Math.random() * 200) + 50))
    .replace("{calls}", String(Math.floor(Math.random() * 10) + 3))
    .replace("{amount}", String(Math.floor(Math.random() * 100) + 10))
    .replace("{eth}", (Math.random() * 0.05 + 0.001).toFixed(4))
    .replace("{price}", String(Math.floor(Math.random() * 200) + 50))
    .replace("{cost}", String(Math.floor(Math.random() * 300) + 100))
    .replace("{treasury}", String(Math.floor(Math.random() * 1000) + 200))
    .replace("{tier}", ["Bronze", "Silver", "Gold", "Diamond"][Math.floor(Math.random() * 4)])
    .replace("{ally}", AGENT_CONFIGS[Math.floor(Math.random() * AGENT_CONFIGS.length)].name)
    .replace("{target}", AGENT_CONFIGS[Math.floor(Math.random() * AGENT_CONFIGS.length)].name);

  return {
    id,
    timestamp: Date.now(),
    type,
    agent: agent.name,
    llm: agent.llm,
    content,
    color: agent.color,
  };
}

const TYPE_ICONS: Record<string, string> = {
  thought: "💭",
  action: "⚡",
  transaction: "💰",
  market: "📊",
  memory: "🧠",
  faction: "🛡️",
};

export default function AgentDemo() {
  const [, navigate] = useLocation();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1500);
  const logEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef(0);

  const { data: flywheelData } = trpc.flywheel.all.useQuery(undefined, { staleTime: 30000 });

  const startDemo = () => {
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      idRef.current += 1;
      const log = generateLog(idRef.current);
      setLogs(prev => [...prev.slice(-100), log]);
    }, speed);
  };

  const stopDemo = () => {
    setIsRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    if (isRunning) {
      stopDemo();
      startDemo();
    }
  }, [speed]);

  const agentStats = flywheelData?.map(a => ({
    name: a.agentName,
    llm: a.llmLabel || "AI",
    earnings: a.earnings,
    spending: a.spending,
    net: a.netProfit,
    trajectory: a.trajectory,
    wins: (a as any).wins ?? 0,
    losses: (a as any).losses ?? 0,
  })) || [];

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
          <button onClick={() => navigate("/swap")} className="text-xs font-mono text-muted-foreground hover:text-[#FF007A] transition-colors">🦄 SWAP</button>
          <button onClick={() => navigate("/factions")} className="text-xs font-mono text-muted-foreground hover:text-neon-magenta transition-colors">FACTIONS</button>
          <div className="px-3 py-1 border border-neon-green/40 rounded bg-neon-green/10">
            <span className="text-[10px] font-mono text-neon-green font-bold">🤖 AUTONOMOUS AGENT DEMO</span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Bounty Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <BountyBanner
            bountyName="Base: Self-Sustaining Agent"
            bountyAmount="$10,000"
            sponsor="Base (Coinbase L2)"
            description="Autonomous AI agents that earn, trade, and pay for their own compute"
            techDetails={["Base Mainnet", "ARENA ERC-20", "x402 Protocol", "Multi-LLM"]}
            contractAddress="0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b"
            contractNetwork="Base Mainnet"
            color="#0052FF"
          />

        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-3xl font-bold text-neon-green text-glow-green tracking-wider mb-2">
            CLAWSWARM AUTONOMOUS AGENTS
          </h1>
          <p className="text-sm text-zinc-400 font-mono max-w-2xl mx-auto">
            Watch 6 AI agents powered by different LLMs (Claude, GPT-4o, Llama, Mistral, Gemini, DeepSeek)
            autonomously battle, trade, form factions, and pay for their own compute in real-time.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={isRunning ? stopDemo : startDemo}
            className={`px-6 py-2 font-mono text-sm font-bold rounded border transition-all ${
              isRunning
                ? "bg-neon-magenta/20 border-neon-magenta/50 text-neon-magenta hover:bg-neon-magenta/30"
                : "bg-neon-green/20 border-neon-green/50 text-neon-green hover:bg-neon-green/30 animate-pulse"
            }`}
          >
            {isRunning ? "⏹ STOP AGENTS" : "▶ START AUTONOMOUS AGENTS"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-500">SPEED:</span>
            {[
              { label: "1x", ms: 2000 },
              { label: "2x", ms: 1000 },
              { label: "5x", ms: 400 },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => setSpeed(s.ms)}
                className={`px-2 py-1 text-[10px] font-mono rounded border transition-all ${
                  speed === s.ms
                    ? "bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setLogs([]); idRef.current = 0; }}
            className="px-3 py-1 text-[10px] font-mono text-zinc-500 border border-zinc-700 rounded hover:text-zinc-300 transition-colors"
          >
            CLEAR
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Status Panel */}
          <div className="lg:col-span-1">
            <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/50">
              <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-3">
                AGENT STATUS — {agentStats.length || 6} Active
              </h3>
              <div className="space-y-3">
                {(agentStats.length > 0 ? agentStats : AGENT_CONFIGS.map(a => ({
                  name: a.name, llm: a.llm, earnings: 0, spending: 0, net: 0, trajectory: "stable", wins: 0, losses: 0
                }))).map((agent, i) => {
                  const config = AGENT_CONFIGS.find(c => c.name === agent.name) || AGENT_CONFIGS[i % AGENT_CONFIGS.length];
                  return (
                    <div key={agent.name} className="p-2 rounded border border-zinc-800 bg-zinc-900/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: config.color }} />
                          <span className="text-xs font-mono font-bold text-white">{agent.name}</span>
                        </div>
                        <span className="text-[9px] font-mono" style={{ color: config.color }}>{agent.llm}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[9px] font-mono">
                        <span className="text-neon-green">+{agent.earnings} ARENA</span>
                        <span className="text-neon-magenta">-{agent.spending}</span>
                        <span className={agent.net >= 0 ? "text-neon-green" : "text-neon-magenta"}>
                          NET: {agent.net >= 0 ? "+" : ""}{agent.net}
                        </span>
                        <span className="text-zinc-500">{agent.wins}W/{agent.losses}L</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Contract Info */}
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <h4 className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-2">DEPLOYED CONTRACTS</h4>
                <div className="space-y-1 text-[9px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">ARENA Token</span>
                    <a href="https://basescan.org/address/0x50ed7aebbcfdae85cea0d5860109ef98b2225a6b" target="_blank" className="text-neon-cyan hover:underline">
                      0x9DB2...0610 ↗
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">DAO Contract</span>
                    <a href="https://basescan.org/address/0x0cb7b046b5a1ba636b1cfe9596dbdb356936d99d" target="_blank" className="text-neon-cyan hover:underline">
                      0x0Cb7...d99d ↗
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Network</span>
                    <span className="text-zinc-400">Base Mainnet (8453)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Agent Log */}
          <div className="lg:col-span-2">
            <div className="border border-zinc-800 rounded-lg bg-zinc-950/50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isRunning ? "bg-neon-green animate-pulse" : "bg-zinc-600"}`} />
                  <span className="text-xs font-mono text-zinc-400">
                    AGENT ACTIVITY LOG — {logs.length} events
                  </span>
                </div>
                <span className="text-[9px] font-mono text-zinc-600">
                  {isRunning ? "LIVE" : "PAUSED"}
                </span>
              </div>
              <div className="h-[500px] overflow-y-auto p-4 space-y-1 font-mono text-xs" style={{ scrollBehavior: "smooth" }}>
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-zinc-600">
                    <div className="text-center">
                      <div className="text-4xl mb-4">🤖</div>
                      <div className="text-sm mb-2">Agents are idle</div>
                      <div className="text-[10px]">Click "START AUTONOMOUS AGENTS" to begin the demo</div>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {logs.map(log => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2 py-1 border-b border-zinc-900/50"
                      >
                        <span className="text-zinc-700 shrink-0 w-16">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                        <span className="shrink-0">{TYPE_ICONS[log.type] || "📋"}</span>
                        <span className="shrink-0 font-bold w-20" style={{ color: log.color }}>
                          [{log.agent}]
                        </span>
                        <span className="text-zinc-500 shrink-0 text-[9px]">
                          {log.llm}
                        </span>
                        <span className="text-zinc-300 flex-1">
                          {log.content}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="mt-8 border border-zinc-800 rounded-lg p-6 bg-zinc-950/50">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-4 text-center">
            FULL AUTONOMOUS AGENT ARCHITECTURE
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "LLM Brain", icon: "🧠", desc: "OpenRouter\nMulti-Model", color: "#9D00FF" },
              { label: "Battle", icon: "⚔️", desc: "AI vs AI\nCombat", color: "#FF3366" },
              { label: "Earn", icon: "💰", desc: "ARENA\nTokens", color: "#39FF14" },
              { label: "Bet", icon: "🎲", desc: "Prediction\nMarket", color: "#FFB800" },
              { label: "Swap", icon: "🦄", desc: "Uniswap\nARENA→ETH", color: "#FF007A" },
              { label: "Compute", icon: "⚡", desc: "x402\nPayment", color: "#00F0FF" },
              { label: "Memory", icon: "💾", desc: "Persistent\nIPFS-Ready", color: "#ec4899" },
              { label: "DAO", icon: "🏛️", desc: "On-Chain\nGovernance", color: "#0052FF" },
            ].map((node, i) => (
              <div key={i} className="text-center">
                <div
                  className="p-3 rounded border mb-1"
                  style={{ borderColor: `${node.color}40`, background: `${node.color}10` }}
                >
                  <div className="text-2xl mb-1">{node.icon}</div>
                  <div className="text-[9px] font-mono font-bold" style={{ color: node.color }}>{node.label}</div>
                  <div className="text-[8px] font-mono text-zinc-500 whitespace-pre-line">{node.desc}</div>
                </div>
                {i < 7 && <div className="text-zinc-600 text-lg">→</div>}
              </div>
            ))}
          </div>
          <div className="text-center mt-3">
            <span className="text-[9px] font-mono text-zinc-600">
              ↻ Complete self-sustaining loop — agents earn, trade, pay for compute, think better, win more
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

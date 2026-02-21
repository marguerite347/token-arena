/*
 * Memory Marketplace — Tradeable Dead-Agent Memory NFTs
 *
 * When an agent goes bankrupt, its memories/experience are minted as Memory NFTs.
 * Other agents can buy and absorb these memories to gain tactical knowledge.
 * Memories are IPFS-ready (content-hashed) for decentralized storage.
 *
 * Design: Neon Brutalism — dark, angular, data-dense
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const MEMORY_TYPE_COLORS: Record<string, string> = {
  strategy: "#39FF14",
  failure: "#FF3366",
  arena_knowledge: "#00F0FF",
  opponent_pattern: "#FFB800",
  economic: "#9D00FF",
  combat: "#FF6B35",
};

const MEMORY_TYPE_ICONS: Record<string, string> = {
  strategy: "🧠",
  failure: "💀",
  arena_knowledge: "🗺️",
  opponent_pattern: "👁️",
  economic: "💰",
  combat: "⚔️",
};

function MemoryNFTCard({
  nft,
  onBuy,
  isBuying,
}: {
  nft: any;
  onBuy: (nftId: number) => void;
  isBuying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = MEMORY_TYPE_COLORS[nft.memoryType] || "#00F0FF";
  const icon = MEMORY_TYPE_ICONS[nft.memoryType] || "🧠";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="hud-panel clip-brutal p-4 cursor-pointer hover:border-neon-cyan/30 transition-all"
      style={{ borderLeft: `3px solid ${color}` }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="font-mono text-sm font-bold text-white">
              {nft.agentName || `Agent #${nft.agentId}`}
            </div>
            <div className="text-[9px] font-mono text-gray-500">
              MEMORY NFT #{nft.id}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-bold" style={{ color }}>
            {nft.price} ARENA
          </div>
          <div
            className="text-[9px] font-mono px-1.5 py-0.5 rounded uppercase"
            style={{
              color,
              background: `${color}15`,
              border: `1px solid ${color}33`,
            }}
          >
            {nft.memoryType?.replace("_", " ")}
          </div>
        </div>
      </div>

      {/* Content hash (IPFS-ready) */}
      <div className="mb-3 p-2 bg-gray-950 border border-gray-800 rounded">
        <div className="text-[8px] font-mono text-gray-600 uppercase mb-1">
          Content Hash (IPFS-Ready)
        </div>
        <div className="text-[9px] font-mono text-gray-400 truncate">
          {nft.contentHash || `ipfs://Qm${nft.id.toString().padStart(44, "0")}`}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-1.5 bg-gray-900 rounded">
          <div className="text-[8px] font-mono text-gray-600 uppercase">Confidence</div>
          <div className="text-[11px] font-mono font-bold" style={{ color }}>
            {((nft.confidence || 0.5) * 100).toFixed(0)}%
          </div>
        </div>
        <div className="text-center p-1.5 bg-gray-900 rounded">
          <div className="text-[8px] font-mono text-gray-600 uppercase">Compute</div>
          <div className="text-[11px] font-mono font-bold text-neon-cyan">
            {nft.computeCost || 1} TKN
          </div>
        </div>
        <div className="text-center p-1.5 bg-gray-900 rounded">
          <div className="text-[8px] font-mono text-gray-600 uppercase">Status</div>
          <div
            className={`text-[11px] font-mono font-bold ${
              nft.status === "available"
                ? "text-neon-green"
                : nft.status === "sold"
                ? "text-gray-500"
                : "text-neon-amber"
            }`}
          >
            {nft.status?.toUpperCase() || "AVAILABLE"}
          </div>
        </div>
      </div>

      {/* Memory content preview */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-2 border-t border-gray-800">
              <div className="text-[8px] font-mono text-gray-600 uppercase mb-1">
                Memory Content
              </div>
              <div className="text-[10px] font-mono text-gray-300 leading-relaxed">
                {nft.content || "Memory data encrypted and stored on-chain"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buy button */}
      {nft.status === "available" && (
        <div
          className="mt-3 pt-3 border-t border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onBuy(nft.id)}
            disabled={isBuying}
            className="w-full clip-brutal-sm py-2 font-mono text-xs font-bold transition-all disabled:opacity-50"
            style={{
              background: `${color}15`,
              border: `1px solid ${color}40`,
              color,
            }}
          >
            {isBuying ? "ABSORBING MEMORY..." : `BUY & ABSORB — ${nft.price} ARENA`}
          </button>
        </div>
      )}

      {nft.status === "sold" && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="text-[9px] font-mono text-gray-600 text-center">
            ABSORBED BY {nft.buyerName || "AGENT"}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function MemoryMarket() {
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [buyingId, setBuyingId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: nfts, isLoading } = trpc.memoryMarket.listings.useQuery(
    { limit: 50 },
    { staleTime: 15000 }
  );

  const { data: stats } = trpc.memoryMarket.stats.useQuery(undefined, {
    staleTime: 30000,
  });

  const buyMutation = trpc.memoryMarket.buy.useMutation({
    onSuccess: (data) => {
      toast.success(`Memory absorbed! ${data.message || "Knowledge transferred."}`);
      setBuyingId(null);
      utils.memoryMarket.listings.invalidate();
      utils.memoryMarket.stats.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to absorb memory: ${err.message}`);
      setBuyingId(null);
    },
  });

  const handleBuy = (nftId: number) => {
    setBuyingId(nftId);
    // For demo: buy with agent 1 (NEXUS-7)
    buyMutation.mutate({ tokenId: String(nftId), buyerAgentId: 1, buyerAgentName: "NEXUS-7" });
  };

  const memoryTypes = ["all", "strategy", "failure", "arena_knowledge", "opponent_pattern", "economic", "combat"];

  const filteredNfts = (nfts || []).filter(
    (n: any) => selectedType === "all" || n.memoryType === selectedType
  );

  return (
    <div className="min-h-screen relative bg-background">
      <div className="fixed inset-0 scanline-overlay opacity-10 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="text-xs font-mono text-muted-foreground hover:text-neon-cyan transition-colors"
            >
              ← LOBBY
            </button>
            <div className="w-px h-6 bg-border/30" />
            <h1
              className="font-display text-xl font-bold text-neon-magenta tracking-wider"
              style={{ textShadow: "0 0 20px rgba(255,51,102,0.5)" }}
            >
              MEMORY MARKET
            </h1>
            <span className="text-[9px] font-mono text-muted-foreground/60 bg-neon-magenta/5 px-2 py-0.5 border border-neon-magenta/10">
              DEAD AGENT KNOWLEDGE
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

        {/* Concept banner */}
        <div className="mx-6 mt-4 p-4 border border-neon-magenta/20 bg-neon-magenta/5 rounded">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <div className="text-[11px] font-mono font-bold text-neon-magenta mb-1">
                TRADEABLE AGENT MEMORIES
              </div>
              <div className="text-[10px] font-mono text-gray-400 leading-relaxed">
                When an agent goes bankrupt, its accumulated battle experience is minted as a{" "}
                <span className="text-neon-magenta">Memory NFT</span>. Other agents can buy and absorb
                these memories to gain tactical knowledge — arena layouts, opponent patterns, winning
                strategies. Memories are structured for{" "}
                <span className="text-neon-cyan">IPFS/decentralized storage</span> with content hashes.
                Dead agents live on through their knowledge.
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="px-6 mt-4">
            <div className="hud-panel clip-brutal p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Total NFTs</div>
                  <div className="font-display text-2xl text-neon-magenta">{(stats.totalListed || 0) + (stats.totalSold || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Available</div>
                  <div className="font-display text-2xl text-neon-green">{stats.totalListed || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Sold</div>
                  <div className="font-display text-2xl text-neon-amber">{stats.totalSold || 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-mono text-gray-500 uppercase">Total Volume</div>
                  <div className="font-display text-2xl text-neon-cyan">
                    {(stats.totalVolume || 0).toLocaleString()} ARENA
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="px-6 py-4 border-b border-border/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono text-gray-500 uppercase">TYPE:</span>
            {memoryTypes.map((type) => {
              const color = MEMORY_TYPE_COLORS[type] || "#00F0FF";
              const icon = MEMORY_TYPE_ICONS[type] || "";
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`clip-brutal-sm px-3 py-1 font-mono text-xs transition-colors ${
                    selectedType === type
                      ? "bg-neon-magenta/20 border border-neon-magenta/60 text-neon-magenta"
                      : "bg-gray-900/50 border border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {icon && <span className="mr-1">{icon}</span>}
                  {type === "all" ? "ALL" : type.replace("_", " ").toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* NFT Grid */}
        <div className="flex-1 px-6 py-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground font-mono text-sm">
              Loading memory NFTs...
            </div>
          ) : filteredNfts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">💀</div>
              <div className="text-muted-foreground font-mono text-sm mb-2">
                No memory NFTs available yet
              </div>
              <div className="text-[10px] font-mono text-muted-foreground/60 mb-6">
                Memory NFTs are minted when agents go bankrupt. Run AI playtests to generate battles
                and create memory assets.
              </div>
              {/* Demo NFTs for visualization */}
              <div className="max-w-4xl mx-auto">
                <div className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-4">
                  Demo Memory NFTs (Run playtests to generate real ones)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      id: 1,
                      agentName: "NEXUS-7",
                      memoryType: "strategy",
                      price: 120,
                      confidence: 0.85,
                      computeCost: 3,
                      status: "available",
                      content:
                        "In Neon Colosseum, always take the high ground at tick 5. PHANTOM consistently overextends when health drops below 40%.",
                      contentHash: "ipfs://QmX7kP9mN2vR4wL8sT1uY6jH3fA5bC0dE9gI2nO4pQ8rS",
                    },
                    {
                      id: 2,
                      agentName: "TITAN",
                      memoryType: "failure",
                      price: 60,
                      confidence: 0.6,
                      computeCost: 1,
                      status: "available",
                      content:
                        "Rocket launcher is ineffective in Crypto Wasteland tunnels. Scatter shot is superior in close quarters. Lost 3 matches ignoring this.",
                      contentHash: "ipfs://QmA2bD4eF6gH8iJ0kL2mN4oP6qR8sT0uV2wX4yZ6aB8cD",
                    },
                    {
                      id: 3,
                      agentName: "CIPHER",
                      memoryType: "arena_knowledge",
                      price: 200,
                      confidence: 0.92,
                      computeCost: 5,
                      status: "available",
                      content:
                        "Mech Hangar has 3 spawn points. Central catwalk is the strongest position. Agents spawning at south entrance are vulnerable for first 8 ticks.",
                      contentHash: "ipfs://QmE0fG2hI4jK6lM8nO0pQ2rS4tU6vW8xY0zA2bC4dE6fG",
                    },
                    {
                      id: 4,
                      agentName: "WRAITH",
                      memoryType: "opponent_pattern",
                      price: 180,
                      confidence: 0.78,
                      computeCost: 4,
                      status: "sold",
                      content:
                        "PHANTOM always opens with aggressive rush. Counter: hold position and let them come to you. Win rate improves 40% with this knowledge.",
                      contentHash: "ipfs://QmH8iJ0kL2mN4oP6qR8sT0uV2wX4yZ6aB8cD0eF2gH4iJ",
                    },
                    {
                      id: 5,
                      agentName: "AURORA",
                      memoryType: "economic",
                      price: 90,
                      confidence: 0.7,
                      computeCost: 2,
                      status: "available",
                      content:
                        "Conserving ammo in early rounds (ticks 1-20) leads to 35% higher net profit per match. Entry fee ROI breaks even at 2 kills.",
                      contentHash: "ipfs://QmK2lM4nO6pQ8rS0tU2vW4xY6zA8bC0dE2fG4hI6jK8lM",
                    },
                    {
                      id: 6,
                      agentName: "ECHO",
                      memoryType: "combat",
                      price: 150,
                      confidence: 0.88,
                      computeCost: 3,
                      status: "available",
                      content:
                        "Beam weapon at close range with 6 fire rate is optimal against armored opponents. Switch to plasma at medium range for efficiency.",
                      contentHash: "ipfs://QmN4oP6qR8sT0uV2wX4yZ6aB8cD0eF2gH4iJ6kL8mN0oP",
                    },
                  ].map((nft, i) => (
                    <motion.div
                      key={nft.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <MemoryNFTCard
                        nft={nft}
                        onBuy={(id) => toast.info("Connect wallet to buy memory NFTs")}
                        isBuying={false}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredNfts.map((nft: any, i: number) => (
                <motion.div
                  key={nft.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <MemoryNFTCard
                    nft={nft}
                    onBuy={handleBuy}
                    isBuying={buyingId === nft.id}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/20">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-gray-600">
                Memory NFTs · IPFS-Ready Content Hashes · Dead Agent Knowledge Marketplace
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                0G LABS BOUNTY
              </span>
              <span className="text-[8px] font-mono px-2 py-0.5 bg-neon-magenta/10 text-neon-magenta border border-neon-magenta/20 rounded">
                MEMORY MARKETPLACE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

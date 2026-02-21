/*
 * Shop Page — Armory & Upgrades with Web3 wallet integration
 * Uses wallet context for real token balances and x402 purchase flow
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { useGame, SHOP_ITEMS, WEAPONS, type ShopItem, type WeaponType } from "@/contexts/GameContext";
import { useWallet } from "@/contexts/WalletContext";
import WalletButton from "@/components/WalletButton";
import { trpc } from "@/lib/trpc";
import { WEAPON_TOKENS } from "@shared/web3";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "weapon", label: "WEAPONS", color: "#00F0FF" },
  { id: "armor", label: "ARMOR", color: "#FF00AA" },
  { id: "consumable", label: "CONSUMABLES", color: "#39FF14" },
  { id: "environment", label: "DEPLOYABLES", color: "#FFB800" },
] as const;

// M4 Skybox: Quantum Computing Lab — dark sci-fi interior, blue neon circuits
const SHOP_BG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/gqKCKZfzZwQkVTLk.jpg";

export default function Shop() {
  const { state, buyItem, equipWeapon } = useGame();
  const wallet = useWallet();
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<string>("weapon");
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  const logX402Mut = trpc.x402.log.useMutation();

  const filteredItems = SHOP_ITEMS.filter((item) => item.category === activeCategory);

  const handleBuy = (item: ShopItem) => {
    if (state.player.tokens < item.price) {
      toast.error("Insufficient tokens", {
        description: `Need ${item.price} TKN, you have ${state.player.tokens} TKN`,
      });
      return;
    }

    // x402 purchase flow
    const result = wallet.purchaseItem(item.price);
    if (!result || !result.success) {
      toast.error("Purchase failed", { description: "x402 payment could not be processed" });
      return;
    }

    // Log the x402 transaction
    logX402Mut.mutate({
      paymentId: `shop-${item.id}-${Date.now()}`,
      txHash: result.txHash,
      action: "shop_purchase",
      tokenSymbol: result.settlement.token,
      amount: result.settlement.amount,
      fromAddress: result.settlement.from,
      toAddress: result.settlement.to,
    });

    const success = buyItem(item);
    if (success) {
      toast.success(`Acquired: ${item.name}`, {
        description: `${item.price} TKN deducted · x402 tx: ${result.txHash.slice(0, 10)}...`,
      });
      if (item.weapon) {
        equipWeapon(item.weapon);
        toast.info(`${item.weapon.name} equipped`);
      }
    }
  };

  const isOwned = (item: ShopItem) => state.inventory.some((i) => i.id === item.id);

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${SHOP_BG})` }}>
        <div className="absolute inset-0 bg-background/85" />
        <div className="absolute inset-0 scanline-overlay opacity-20" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/arena")}
              className="text-xs font-mono text-muted-foreground hover:text-neon-cyan transition-colors"
            >
              ← BACK TO ARENA
            </button>
            <div className="w-px h-6 bg-border/30" />
            <h1 className="font-display text-xl font-bold text-neon-cyan text-glow-cyan tracking-wider">
              ARMORY
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Wallet token balances */}
            <div className="flex items-center gap-2">
              {wallet.tokenBalances.filter(t => t.symbol !== "ARENA").slice(0, 4).map((t) => (
                <div key={t.symbol} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-background/30 border border-border/20">
                  <div className="w-1.5 h-1.5" style={{ backgroundColor: t.color }} />
                  <span className="font-mono text-[9px]" style={{ color: t.color }}>{t.balance}</span>
                  <span className="font-mono text-[7px] text-muted-foreground/50">{t.symbol}</span>
                </div>
              ))}
            </div>
            <div className="hud-panel clip-brutal-sm px-4 py-1.5">
              <span className="text-[9px] font-mono text-muted-foreground mr-2">BALANCE</span>
              <span className="font-display text-lg text-neon-green text-glow-green">{wallet.arenaBalance}</span>
              <span className="text-[10px] font-mono text-neon-green/70 ml-1">ARENA</span>
            </div>
            <div className="hud-panel clip-brutal-sm px-4 py-1.5">
              <span className="text-[9px] font-mono text-muted-foreground mr-2">WEAPON</span>
              <span className="font-mono text-sm" style={{ color: state.player.weapon.color }}>
                {state.player.weapon.name}
              </span>
            </div>
            <WalletButton compact />
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex">
          {/* Category sidebar */}
          <nav className="w-48 border-r border-border/30 p-4 space-y-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setSelectedItem(null); }}
                className={`w-full text-left clip-brutal-sm px-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-all ${
                  activeCategory === cat.id
                    ? "bg-white/5 border border-white/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                style={activeCategory === cat.id ? { color: cat.color, borderColor: cat.color + "40" } : {}}
              >
                {cat.label}
              </button>
            ))}

            {/* Quick equip weapons */}
            <div className="pt-4 border-t border-border/30">
              <div className="text-[9px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Quick Equip</div>
              {(Object.keys(WEAPONS) as WeaponType[]).map((key) => {
                const w = WEAPONS[key];
                const token = WEAPON_TOKENS[key];
                const owned = key === "plasma" || state.inventory.some((i) => i.weapon?.type === key);
                return (
                  <button
                    key={key}
                    onClick={() => owned && equipWeapon(w)}
                    disabled={!owned}
                    className={`w-full text-left px-2 py-1 text-[10px] font-mono transition-colors ${
                      state.player.weapon.type === key
                        ? "text-foreground"
                        : owned
                          ? "text-muted-foreground hover:text-foreground"
                          : "text-muted-foreground/30"
                    }`}
                    style={state.player.weapon.type === key ? { color: w.color } : {}}
                  >
                    {state.player.weapon.type === key ? "▸ " : "  "}
                    {w.name}
                    {token && <span className="text-[8px] ml-1 text-muted-foreground/40">{token.symbol}</span>}
                    {!owned && " 🔒"}
                  </button>
                );
              })}
            </div>

            {/* x402 / Base L2 info */}
            <div className="pt-4 border-t border-border/30">
              <div className="text-[9px] font-mono text-muted-foreground mb-2 uppercase tracking-wider">Protocol</div>
              <div className="space-y-1 text-[8px] font-mono text-muted-foreground/50">
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.5 bg-neon-green/10 text-neon-green border border-neon-green/20">x402</span>
                  <span>payments</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.5 bg-neon-cyan/10 text-neon-cyan/70 border border-neon-cyan/10">Base</span>
                  <span>Sepolia L2</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="px-1 py-0.5 bg-neon-magenta/10 text-neon-magenta/70 border border-neon-magenta/10">8004</span>
                  <span>agent identity</span>
                </div>
              </div>
            </div>
          </nav>

          {/* Items grid */}
          <div className="flex-1 p-6">
            <div className="grid grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item, i) => {
                  const owned = isOwned(item);
                  const canAfford = state.player.tokens >= item.price;
                  const catColor = CATEGORIES.find((c) => c.id === item.category)?.color || "#00F0FF";

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <button
                        onClick={() => setSelectedItem(item)}
                        className={`w-full text-left hud-panel clip-brutal p-4 transition-all group ${
                          selectedItem?.id === item.id ? "neon-glow-cyan" : "hover:border-white/20"
                        } ${owned ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-2xl">{item.icon}</span>
                          {owned && (
                            <span className="text-[8px] font-mono text-neon-green bg-neon-green/10 px-1.5 py-0.5 clip-brutal-sm">
                              OWNED
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-sm text-foreground mb-1 group-hover:animate-glitch">
                          {item.name}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground mb-3 leading-relaxed">
                          {item.description}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-display text-lg" style={{ color: canAfford ? catColor : "#FF3333" }}>
                            {item.price}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground">TKN</span>
                        </div>

                        {item.weapon && (
                          <div className="mt-2 pt-2 border-t border-border/20 grid grid-cols-2 gap-1 text-[9px] font-mono text-muted-foreground">
                            <div>DMG: <span style={{ color: catColor }}>{item.weapon.damage}</span></div>
                            <div>COST: <span className="text-neon-amber">{item.weapon.tokenCost}/shot</span></div>
                            <div>RATE: <span style={{ color: catColor }}>{item.weapon.fireRate}ms</span></div>
                            <div>SPD: <span style={{ color: catColor }}>{item.weapon.projectileSpeed}</span></div>
                          </div>
                        )}

                        {item.armorValue && (
                          <div className="mt-2 pt-2 border-t border-border/20 text-[9px] font-mono text-muted-foreground">
                            Damage Reduction: <span style={{ color: catColor }}>{item.armorValue}%</span>
                          </div>
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {selectedItem && (
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 100, opacity: 0 }}
                className="w-72 border-l border-border/30 p-4"
              >
                <div className="hud-panel clip-brutal p-4">
                  <div className="text-3xl mb-3">{selectedItem.icon}</div>
                  <div className="font-display text-lg text-foreground mb-1">{selectedItem.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mb-4 leading-relaxed">
                    {selectedItem.description}
                  </div>

                  {selectedItem.weapon && (
                    <div className="space-y-2 mb-4">
                      <div className="text-[9px] font-sans uppercase tracking-[0.2em] text-foreground/60">Weapon Stats</div>
                      <div className="space-y-1">
                        {[
                          { label: "Damage", value: selectedItem.weapon.damage, max: 50 },
                          { label: "Fire Rate", value: Math.max(0, 100 - selectedItem.weapon.fireRate / 30), max: 100 },
                          { label: "Speed", value: selectedItem.weapon.projectileSpeed, max: 30 },
                          { label: "Token Cost", value: selectedItem.weapon.tokenCost, max: 15 },
                        ].map((stat) => (
                          <div key={stat.label}>
                            <div className="flex justify-between text-[9px] font-mono text-muted-foreground mb-0.5">
                              <span>{stat.label}</span>
                              <span>{stat.label === "Fire Rate" ? `${selectedItem.weapon!.fireRate}ms` : stat.value}</span>
                            </div>
                            <div className="h-1 bg-background/50 clip-brutal-sm">
                              <div className="h-full bg-neon-cyan" style={{ width: `${(stat.value / stat.max) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="font-display text-2xl text-neon-green text-glow-green">{selectedItem.price}</div>
                      <div className="text-[9px] font-mono text-muted-foreground">TKN</div>
                    </div>
                    <div className="text-right text-[9px] font-mono text-muted-foreground">
                      Balance: {wallet.arenaBalance} ARENA
                    </div>
                  </div>

                  {isOwned(selectedItem) ? (
                    <div className="clip-brutal-sm px-4 py-2 text-center text-xs font-mono text-neon-green bg-neon-green/10">
                      ALREADY OWNED
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuy(selectedItem)}
                      disabled={state.player.tokens < selectedItem.price}
                      className="w-full clip-brutal-sm px-4 py-2 text-center text-xs font-mono text-background bg-neon-cyan hover:bg-neon-cyan/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {state.player.tokens >= selectedItem.price ? "PURCHASE (x402)" : "INSUFFICIENT TOKENS"}
                    </button>
                  )}

                  {/* On-chain info */}
                  <div className="mt-4 pt-3 border-t border-border/20">
                    <div className="text-[8px] font-mono text-muted-foreground/50 space-y-0.5">
                      <div>chain: Base Mainnet L2</div>
                      <div>payment: x402 protocol</div>
                      <div>identity: ERC-8004</div>
                      <div>wallet: {wallet.address ? `${wallet.address.slice(0, 8)}...` : "not connected"}</div>
                      <div>status: {wallet.isConnected ? "● on-chain" : "○ simulated"}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

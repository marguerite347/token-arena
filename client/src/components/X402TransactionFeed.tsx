/**
 * X402TransactionFeed — Real-time display of x402 payment transactions
 * Shows the on-chain token flow during gameplay: shoots, hits, collections
 */
import { useState, useEffect, useRef } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { WEAPON_TOKENS, type X402PaymentResponse } from "@shared/web3";

interface Props {
  maxItems?: number;
  compact?: boolean;
}

export default function X402TransactionFeed({ maxItems = 8, compact = false }: Props) {
  const { completedPayments } = useWallet();
  const feedRef = useRef<HTMLDivElement>(null);
  const [displayPayments, setDisplayPayments] = useState<X402PaymentResponse[]>([]);

  useEffect(() => {
    setDisplayPayments(completedPayments.slice(-maxItems));
  }, [completedPayments, maxItems]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [displayPayments]);

  const getTokenColor = (symbol: string): string => {
    for (const [, token] of Object.entries(WEAPON_TOKENS)) {
      if (token.symbol === symbol) return token.color;
    }
    return "#39FF14"; // ARENA default
  };

  const shortenAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (compact) {
    return (
      <div className="space-y-0.5" ref={feedRef}>
        {displayPayments.map((tx, i) => (
          <div key={i} className="flex items-center gap-1 font-mono text-[8px]">
            <span className="text-muted-foreground/50">{new Date(tx.settlement.timestamp).toLocaleTimeString()}</span>
            <span style={{ color: getTokenColor(tx.settlement.token) }}>
              {tx.settlement.amount} {tx.settlement.token}
            </span>
            <span className="text-muted-foreground/30">→</span>
            <span className="text-muted-foreground/50">{shortenAddr(tx.txHash)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="hud-panel clip-brutal p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] font-mono text-neon-cyan/70 uppercase tracking-wider">x402 Transaction Feed</div>
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 bg-neon-green rounded-full animate-pulse" />
          <span className="text-[8px] font-mono text-neon-green/60">LIVE</span>
        </div>
      </div>

      <div
        ref={feedRef}
        className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
      >
        {displayPayments.length === 0 ? (
          <div className="text-[9px] font-mono text-muted-foreground/40 text-center py-4">
            No transactions yet — start a match to see x402 payments
          </div>
        ) : (
          displayPayments.map((tx, i) => (
            <div
              key={i}
              className="flex items-center gap-2 py-1 border-b border-border/10 last:border-0 animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {/* Status indicator */}
              <div className={`w-1.5 h-1.5 ${tx.success ? "bg-neon-green" : "bg-neon-magenta"}`} />

              {/* Token amount */}
              <div className="flex items-center gap-1 min-w-[60px]">
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: getTokenColor(tx.settlement.token) }}
                >
                  {tx.settlement.amount}
                </span>
                <span
                  className="font-mono text-[8px]"
                  style={{ color: getTokenColor(tx.settlement.token), opacity: 0.6 }}
                >
                  {tx.settlement.token}
                </span>
              </div>

              {/* From → To */}
              <div className="flex items-center gap-1 flex-1">
                <span className="font-mono text-[8px] text-muted-foreground/60">
                  {shortenAddr(tx.settlement.from)}
                </span>
                <span className="text-[8px] text-neon-cyan/40">→</span>
                <span className="font-mono text-[8px] text-muted-foreground/60">
                  {shortenAddr(tx.settlement.to)}
                </span>
              </div>

              {/* Tx hash */}
              <span className="font-mono text-[7px] text-muted-foreground/30">
                {shortenAddr(tx.txHash)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
        <span className="font-mono text-[8px] text-muted-foreground/50">
          {completedPayments.length} total txns
        </span>
        <span className="font-mono text-[8px] text-muted-foreground/50">
          Base Mainnet · x402 Protocol
        </span>
      </div>
    </div>
  );
}

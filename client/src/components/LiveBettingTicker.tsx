import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { TrendingUp, DollarSign, Zap } from "lucide-react";

interface TickerItem {
  id: number;
  bettorName: string;
  bettorType: string;
  amount: number;
  marketTitle: string | null;
  status: string;
  createdAt: Date;
}

const BETTOR_COLORS: Record<string, string> = {
  agent: "text-cyan-400",
  spectator: "text-purple-400",
  player: "text-green-400",
};

const BETTOR_ICONS: Record<string, string> = {
  agent: "🤖",
  spectator: "👁️",
  player: "🎮",
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export function LiveBettingTicker() {
  const tickerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const { data: bets } = trpc.prediction.recentBets.useQuery(
    { limit: 30 },
    { refetchInterval: 8000 } // Poll every 8 seconds
  );

  // Auto-scroll the ticker
  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker || isPaused) return;

    let animFrame: number;
    let position = 0;

    const scroll = () => {
      position += 0.5;
      if (position >= ticker.scrollWidth / 2) {
        position = 0;
      }
      ticker.scrollLeft = position;
      animFrame = requestAnimationFrame(scroll);
    };

    animFrame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animFrame);
  }, [bets, isPaused]);

  if (!bets || bets.length === 0) return null;

  // Duplicate items for seamless loop
  const items = [...bets, ...bets];

  return (
    <div
      className="w-full bg-slate-950/90 border-b border-slate-800/50 backdrop-blur-sm overflow-hidden"
      style={{ height: "36px" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center h-full">
        {/* Label */}
        <div className="flex items-center gap-1.5 px-3 bg-green-500/20 border-r border-green-500/30 h-full shrink-0">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <TrendingUp className="w-3 h-3 text-green-400" />
          <span className="text-xs font-bold text-green-400 font-mono">LIVE BETS</span>
        </div>

        {/* Scrolling ticker */}
        <div
          ref={tickerRef}
          className="flex items-center gap-0 overflow-hidden whitespace-nowrap flex-1"
          style={{ scrollBehavior: "auto" }}
        >
          {items.map((bet, i) => (
            <div
              key={`ticker-${bet.id}-${i}`}
              className="flex items-center gap-1.5 px-4 border-r border-slate-800/50 h-full shrink-0"
            >
              <span className="text-xs">{BETTOR_ICONS[bet.bettorType] || "💰"}</span>
              <span className={`text-xs font-semibold ${BETTOR_COLORS[bet.bettorType] || "text-slate-300"}`}>
                {bet.bettorName}
              </span>
              <span className="text-xs text-slate-500">bet</span>
              <span className="text-xs font-bold text-yellow-400">
                {bet.amount} ARENA
              </span>
              {bet.marketTitle && (
                <>
                  <span className="text-xs text-slate-500">on</span>
                  <span className="text-xs text-slate-300 max-w-[160px] truncate">
                    {bet.marketTitle}
                  </span>
                </>
              )}
              <span className="text-xs text-slate-600 ml-1">
                {formatTimeAgo(bet.createdAt)}
              </span>
              {bet.status === "won" && (
                <span className="text-xs text-green-400 font-bold">✓ WON</span>
              )}
            </div>
          ))}
        </div>

        {/* Right badge */}
        <div className="flex items-center gap-1 px-3 bg-slate-900 border-l border-slate-700/50 h-full shrink-0">
          <DollarSign className="w-3 h-3 text-yellow-400" />
          <span className="text-xs text-yellow-400 font-mono font-bold">
            {bets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} ARENA
          </span>
        </div>
      </div>
    </div>
  );
}

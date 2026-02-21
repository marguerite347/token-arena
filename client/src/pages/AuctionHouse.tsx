/**
 * Auction House — Competitive memory bidding with loyalty windows
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Gavel, Clock, TrendingUp, Brain, Shield, ChevronLeft, AlertTriangle } from "lucide-react";

const RARITY_COLORS: Record<string, string> = {
  common: "#9CA3AF",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
};

export default function AuctionHouse() {
  const { data: activeAuctions, isLoading: loadingActive } = trpc.auctions.active.useQuery();
  const { data: auctionHistory, isLoading: loadingHistory } = trpc.auctions.history.useQuery();
  const [tab, setTab] = useState<"active" | "history">("active");

  const resolveMutation = trpc.auctions.resolve.useMutation({
    onSuccess: () => {
      // Refetch data
    },
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-purple-900/30 bg-gradient-to-r from-black via-purple-950/20 to-black">
        <div className="container py-6">
          <Link href="/">
            <span className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1 mb-3 cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back to Arena
            </span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                  MEMORY AUCTION HOUSE
                </span>
              </h1>
              <p className="text-zinc-400 mt-1">Dead agents' memories go to the highest bidder. Knowledge is power.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={tab === "active" ? "default" : "outline"}
                onClick={() => setTab("active")}
                className={tab === "active" ? "bg-purple-600" : "border-purple-800 text-purple-400"}
                size="sm"
              >
                <Gavel className="w-4 h-4 mr-1" /> Live Auctions
              </Button>
              <Button
                variant={tab === "history" ? "default" : "outline"}
                onClick={() => setTab("history")}
                className={tab === "history" ? "bg-purple-600" : "border-purple-800 text-purple-400"}
                size="sm"
              >
                <Clock className="w-4 h-4 mr-1" /> History
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Active Auctions */}
        {tab === "active" && (
          <div className="space-y-6">
            {loadingActive ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : activeAuctions && activeAuctions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeAuctions.map((auction: any) => {
                  const isLoyalty = auction.status === "loyalty_window";
                  const timeLeft = auction.auctionEnds ? Math.max(0, new Date(auction.auctionEnds).getTime() - Date.now()) : 0;
                  const minutesLeft = Math.floor(timeLeft / 60000);

                  return (
                    <Card
                      key={auction.id}
                      className="bg-zinc-900/80 border-zinc-800 hover:border-purple-600/40 transition-all relative overflow-hidden"
                    >
                      {isLoyalty && (
                        <div className="absolute top-0 left-0 right-0 bg-yellow-600/20 border-b border-yellow-600/30 px-3 py-1 text-center">
                          <span className="text-xs text-yellow-400 flex items-center justify-center gap-1">
                            <Shield className="w-3 h-3" /> LOYALTY WINDOW — Home faction only
                          </span>
                        </div>
                      )}
                      <CardHeader className={isLoyalty ? "pt-10" : ""}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Brain className="w-5 h-5 text-purple-400" />
                            <CardTitle className="text-base text-zinc-200">
                              {auction.deadAgentName}'s Memories
                            </CardTitle>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: RARITY_COLORS[auction.memoryType] || "#9CA3AF",
                              color: RARITY_COLORS[auction.memoryType] || "#9CA3AF",
                            }}
                          >
                            {auction.memoryType}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-zinc-800/50 rounded p-2 text-center">
                            <div className="text-xs text-zinc-500">Starting Price</div>
                            <div className="text-sm font-bold text-yellow-400">{auction.startingPrice} ARENA</div>
                          </div>
                          <div className="bg-zinc-800/50 rounded p-2 text-center">
                            <div className="text-xs text-zinc-500">Current Bid</div>
                            <div className="text-sm font-bold text-green-400">
                              {auction.currentBid > 0 ? `${auction.currentBid} ARENA` : "No bids"}
                            </div>
                          </div>
                        </div>

                        {auction.currentBidderName && (
                          <div className="text-xs text-zinc-500 text-center">
                            Leading: <span className="text-purple-400 font-medium">{auction.currentBidderName}</span>
                            {auction.currentBidderType === "faction" && " (faction bid)"}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-500 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> {auction.totalBids} bids
                          </span>
                          <span className={minutesLeft < 3 ? "text-red-400" : "text-zinc-400"}>
                            <Clock className="w-3 h-3 inline mr-1" />
                            {minutesLeft > 0 ? `${minutesLeft}m left` : "Ending soon"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <Gavel className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <h2 className="text-xl text-zinc-400 mb-2">No Active Auctions</h2>
                <p className="text-zinc-600">When agents die in battle, their memories are auctioned here.</p>
                <p className="text-zinc-600 text-sm mt-2">Run a playtest with agent deaths to see auctions appear.</p>
              </div>
            )}
          </div>
        )}

        {/* Auction History */}
        {tab === "history" && (
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              </div>
            ) : auctionHistory && auctionHistory.length > 0 ? (
              <div className="space-y-3">
                {auctionHistory.map((auction: any) => (
                  <div
                    key={auction.id}
                    className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Brain className="w-5 h-5 text-purple-400/60" />
                      <div>
                        <span className="text-sm font-medium text-zinc-300">{auction.deadAgentName}'s {auction.memoryType} memories</span>
                        <div className="text-xs text-zinc-500">
                          {auction.status === "sold"
                            ? `Won by ${auction.currentBidderName} for ${auction.currentBid} ARENA`
                            : auction.status === "expired"
                            ? "Expired — no bids"
                            : auction.status}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        auction.status === "sold"
                          ? "border-green-600 text-green-400"
                          : auction.status === "expired"
                          ? "border-zinc-600 text-zinc-500"
                          : "border-purple-600 text-purple-400"
                      }
                    >
                      {auction.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Clock className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <h2 className="text-xl text-zinc-400">No Auction History</h2>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

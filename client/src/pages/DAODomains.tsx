/**
 * DAO Domain Controllers — Each council master controls a specific domain
 */
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, Wallet, Cpu, Zap, ChevronLeft, Activity, ExternalLink } from "lucide-react";

const DOMAIN_ICONS: Record<string, string> = {
  matchmaking: "⚔️",
  economy: "💰",
  arenas: "🏟️",
  rules: "⚖️",
  balance: "⚡",
};

const DOMAIN_COLORS: Record<string, string> = {
  matchmaking: "#FF3366",
  economy: "#FFB800",
  arenas: "#00F0FF",
  rules: "#9D00FF",
  balance: "#00FF88",
};

const DAO_CONTRACT = "0x0Cb7B046b5A1Ba636B1cfE9596DBDB356936d99d";

export default function DAODomains() {
  const { data: wallets, isLoading, refetch } = trpc.daoDomains.wallets.useQuery();
  const { data: actions } = trpc.daoDomains.actions.useQuery();
  const { data: config } = trpc.daoDomains.config.useQuery();

  const initMutation = trpc.daoDomains.init.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const hasWallets = wallets && wallets.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-emerald-900/30 bg-gradient-to-r from-black via-emerald-950/20 to-black">
        <div className="container py-6">
          <Link href="/">
            <span className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1 mb-3 cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back to Arena
            </span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  DAO DOMAIN CONTROLLERS
                </span>
              </h1>
              <p className="text-zinc-400 mt-1">5 autonomous masters govern the arena. Each controls a domain with their own wallet and compute budget.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {!hasWallets && (
                <Button
                  onClick={() => initMutation.mutate()}
                  disabled={initMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500"
                  size="sm"
                >
                  {initMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Initialize Domains
                </Button>
              )}
              <a
                href={`https://sepolia.basescan.org/address/${DAO_CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400/60 hover:text-emerald-400 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> DAO Contract on BaseScan
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Domain Cards */}
        {hasWallets && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map((wallet: any) => {
              const color = DOMAIN_COLORS[wallet.domain] || "#00F0FF";
              const icon = DOMAIN_ICONS[wallet.domain] || "🔧";
              const domainConfig = config ? (config as any)[wallet.domain] : null;
              const computeUsed = wallet.computeSpent || 0;
              const computeTotal = wallet.computeBudget || 5000;
              const computePercent = Math.round((computeUsed / computeTotal) * 100);

              return (
                <Card
                  key={wallet.id}
                  className="bg-zinc-900/80 border-zinc-800 hover:border-opacity-80 transition-all"
                  style={{ borderColor: color + "40" }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                          style={{ backgroundColor: color + "15" }}
                        >
                          {icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg" style={{ color }}>
                            {wallet.councilMemberName}
                          </CardTitle>
                          <span className="text-xs text-zinc-500 uppercase">{wallet.domain}</span>
                        </div>
                      </div>
                      <Crown className="w-5 h-5" style={{ color: color + "80" }} />
                    </div>
                    {domainConfig && (
                      <p className="text-xs text-zinc-500 mt-2">{domainConfig.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Wallet & Compute */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-800/50 rounded p-3">
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                          <Wallet className="w-3 h-3" /> Wallet
                        </div>
                        <div className="text-lg font-bold text-yellow-400">
                          {wallet.walletBalance?.toLocaleString()} <span className="text-xs text-zinc-500">ARENA</span>
                        </div>
                      </div>
                      <div className="bg-zinc-800/50 rounded p-3">
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mb-1">
                          <Cpu className="w-3 h-3" /> Compute
                        </div>
                        <div className="text-lg font-bold" style={{ color }}>
                          {computePercent}% <span className="text-xs text-zinc-500">used</span>
                        </div>
                      </div>
                    </div>

                    {/* Compute Bar */}
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${computePercent}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>

                    {/* Actions Performed */}
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" /> {wallet.actionsPerformed || 0} actions
                      </span>
                      {wallet.lastActionDescription && (
                        <span className="text-zinc-600 truncate max-w-[150px]" title={wallet.lastActionDescription}>
                          Last: {wallet.lastActionDescription}
                        </span>
                      )}
                    </div>

                    {/* Available Actions */}
                    {domainConfig && (
                      <div className="pt-2 border-t border-zinc-800">
                        <div className="text-xs text-zinc-500 mb-2">Available Actions:</div>
                        <div className="flex flex-wrap gap-1">
                          {domainConfig.actions.map((action: string) => (
                            <Badge
                              key={action}
                              variant="outline"
                              className="text-[10px]"
                              style={{ borderColor: color + "30", color: color + "80" }}
                            >
                              {action.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Recent Domain Actions */}
        {actions && actions.length > 0 && (
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-300 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Recent Domain Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actions.map((action: any) => (
                  <div key={action.id} className="flex items-center justify-between bg-zinc-800/30 rounded px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{DOMAIN_ICONS[action.domain] || "🔧"}</span>
                      <div>
                        <span className="text-sm text-zinc-300">{action.description}</span>
                        <div className="text-xs text-zinc-500">
                          {action.domain} → {action.actionType.replace(/_/g, " ")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-cyan-400">{action.computeCost} compute</div>
                      {action.tokenCost > 0 && (
                        <div className="text-xs text-yellow-400">{action.tokenCost} ARENA</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!hasWallets && !isLoading && (
          <div className="text-center py-20">
            <Crown className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl text-zinc-400 mb-2">Domain Controllers Not Initialized</h2>
            <p className="text-zinc-600 mb-6">Initialize the DAO domain system to give each council master their own wallet and compute budget.</p>
          </div>
        )}
      </div>
    </div>
  );
}

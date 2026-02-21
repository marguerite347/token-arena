/**
 * Factions Dashboard — View all factions, members, lone wolves, and faction operations
 */
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Swords, Shield, Skull, UserPlus, ArrowLeftRight, Zap, Crown, ChevronLeft } from "lucide-react";


const LLM_ICONS: Record<string, string> = {
  "anthropic/claude-3.5-sonnet": "🧠",
  "openai/gpt-4o": "⚡",
  "meta-llama/llama-3.1-70b-instruct:free": "🦙",
  "mistralai/mistral-large-latest": "🌬️",
  "google/gemini-2.0-flash-001": "✨",
  "deepseek/deepseek-r1-distill-llama-70b:free": "🔮",
};

export default function Factions() {
  const { data: factions, isLoading, refetch } = trpc.factions.all.useQuery();
  const { data: loneWolves } = trpc.factions.loneWolves.useQuery();
  const seedMutation = trpc.factions.seed.useMutation({
    onSuccess: () => { refetch(); },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const hasFactions = factions && factions.length > 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-cyan-900/30 bg-gradient-to-r from-black via-cyan-950/20 to-black">
        <div className="container py-6">
          <Link href="/">
            <span className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1 mb-3 cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back to Arena
            </span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                  FACTION WAR ROOM
                </span>
              </h1>
              <p className="text-zinc-400 mt-1">Agents form swarms. Swarms dominate the arena.</p>
            </div>
            {!hasFactions && (
              <Button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-500"
              >
                {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                Initialize Factions
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-8">
        {/* Faction Cards */}
        {hasFactions && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {factions.map((faction: any) => (
              <Card
                key={faction.id}
                className="bg-zinc-900/80 border-zinc-800 hover:border-opacity-80 transition-all"
                style={{ borderColor: faction.color + "40" }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                        style={{ backgroundColor: faction.color + "20", color: faction.color }}
                      >
                        {faction.tag?.[1] || "?"}
                      </div>
                      <div>
                        <CardTitle className="text-lg" style={{ color: faction.color }}>
                          {faction.name}
                        </CardTitle>
                        <span className="text-xs text-zinc-500 font-mono">{faction.tag}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs" style={{ borderColor: faction.color + "60", color: faction.color }}>
                      <Crown className="w-3 h-3 mr-1" />
                      {faction.leaderAgentName}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 italic mt-2">"{faction.motto}"</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-zinc-800/50 rounded p-2">
                      <div className="text-lg font-bold" style={{ color: faction.color }}>{faction.totalMembers}</div>
                      <div className="text-[10px] text-zinc-500 uppercase">Members</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2">
                      <div className="text-lg font-bold text-yellow-400">{faction.sharedBalance?.toLocaleString() || 0}</div>
                      <div className="text-[10px] text-zinc-500 uppercase">ARENA</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded p-2">
                      <div className="text-lg font-bold text-purple-400">{faction.reputationScore || 100}</div>
                      <div className="text-[10px] text-zinc-500 uppercase">Rep</div>
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <h4 className="text-xs text-zinc-500 uppercase mb-2 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Roster
                    </h4>
                    <div className="space-y-1">
                      {faction.members?.map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between bg-zinc-800/30 rounded px-2 py-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              {m.role === "leader" ? "👑" : m.isSubAgent ? "🧬" : "⚔️"}
                            </span>
                            <span className="text-sm font-medium text-zinc-300">{m.agentName}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-[10px] h-5">
                              {m.role}
                            </Badge>
                            {m.contribution > 0 && (
                              <span className="text-[10px] text-yellow-400">{m.contribution} ARENA</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Faction Wins/Losses */}
                  <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                    <span className="flex items-center gap-1">
                      <Swords className="w-3 h-3 text-green-400" /> {faction.totalWins || 0}W
                    </span>
                    <span className="flex items-center gap-1">
                      <Skull className="w-3 h-3 text-red-400" /> {faction.totalLosses || 0}L
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-400" /> {faction.totalBattles || 0} Battles
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Lone Wolves */}
        {loneWolves && loneWolves.length > 0 && (
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg text-zinc-300 flex items-center gap-2">
                🐺 Lone Wolves
                <Badge variant="outline" className="text-xs">{loneWolves.length} unaffiliated</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {loneWolves.map((agent: any) => (
                  <div key={agent.id} className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <div className="text-sm font-bold text-zinc-300">{agent.name}</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {LLM_ICONS[agent.llmModel || ""] || "🤖"} {agent.llmModel?.split("/").pop()?.split(":")[0] || "Default"}
                    </div>
                    <div className="text-xs text-yellow-400 mt-1">{agent.totalTokensEarned?.toLocaleString() || 0} ARENA</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!hasFactions && !isLoading && (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl text-zinc-400 mb-2">No Factions Yet</h2>
            <p className="text-zinc-600 mb-6">Initialize the faction system to create default swarms and assign agents.</p>
          </div>
        )}
      </div>
    </div>
  );
}

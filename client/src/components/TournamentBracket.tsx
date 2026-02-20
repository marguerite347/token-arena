/**
 * TournamentBracket — Visual bracket display with prediction markets
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type Tournament,
  type BracketMatch,
  type TournamentAgent,
  getRoundName,
} from "@/lib/tournamentEngine";

interface TournamentBracketProps {
  tournament: Tournament;
  onStartMatch: (match: BracketMatch) => void;
  onStartNextRound: () => void;
  onClose: () => void;
}

function MatchCard({
  match,
  roundName,
  isActive,
  onStart,
}: {
  match: BracketMatch;
  roundName: string;
  isActive: boolean;
  onStart: () => void;
}) {
  const getAgentDisplay = (agent: TournamentAgent | null, isWinner: boolean) => {
    if (!agent) {
      return (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-900/50 rounded">
          <div className="w-2 h-2 rounded-full bg-gray-700" />
          <span className="text-xs font-mono text-gray-600">TBD</span>
        </div>
      );
    }
    return (
      <div
        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded transition-colors ${
          match.status === "complete"
            ? isWinner
              ? "bg-green-500/10 border border-green-500/30"
              : "bg-red-500/5 border border-red-500/10 opacity-50"
            : "bg-gray-900/50 border border-gray-800"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: agent.color }}
          />
          <span
            className={`text-xs font-mono ${
              match.status === "complete" && !isWinner
                ? "text-gray-500 line-through"
                : "text-gray-200"
            }`}
            style={isWinner ? { color: agent.color } : {}}
          >
            {agent.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {match.status === "complete" && (
            <span className="text-[10px] font-mono text-gray-500">
              {agent.id === match.agent1?.id ? match.kills.agent1 : match.kills.agent2}K
            </span>
          )}
          <span className="text-[10px] font-mono text-gray-600">
            #{agent.seed}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`w-44 rounded-lg overflow-hidden transition-all ${
        isActive
          ? "ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-500/10"
          : match.status === "complete"
          ? "opacity-80"
          : ""
      }`}
    >
      <div className="space-y-0.5 p-1 bg-black/40 border border-gray-800 rounded-lg">
        {getAgentDisplay(match.agent1, match.winner?.id === match.agent1?.id)}
        {getAgentDisplay(match.agent2, match.winner?.id === match.agent2?.id)}
      </div>
      {isActive && match.agent1 && match.agent2 && match.status !== "complete" && (
        <button
          onClick={onStart}
          className="w-full py-1 bg-cyan-500/20 text-cyan-400 text-xs font-mono hover:bg-cyan-500/30 transition-colors border-t border-cyan-500/20"
        >
          ▶ START MATCH
        </button>
      )}
      {match.status === "in_progress" && (
        <div className="w-full py-1 bg-yellow-500/20 text-yellow-400 text-xs font-mono text-center border-t border-yellow-500/20 animate-pulse">
          ⚔ IN PROGRESS
        </div>
      )}
    </div>
  );
}

export default function TournamentBracket({
  tournament,
  onStartMatch,
  onStartNextRound,
  onClose,
}: TournamentBracketProps) {
  const [showPredictions, setShowPredictions] = useState(true);
  const totalRounds = tournament.rounds.length;
  const currentRound = tournament.rounds[tournament.currentRound - 1];

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Header */}
      <div className="border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-cyan-400 hover:text-cyan-300 font-mono text-sm px-3 py-1 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition-colors"
            >
              ← BACK
            </button>
            <div>
              <h1 className="text-lg font-mono text-cyan-400 tracking-wider">
                {tournament.name}
              </h1>
              <div className="text-xs font-mono text-gray-500">
                {tournament.size} AGENTS • {totalRounds} ROUNDS •{" "}
                {tournament.status === "finished" ? (
                  <span className="text-yellow-400">CHAMPION: {tournament.champion?.name}</span>
                ) : (
                  <span className="text-cyan-400">
                    {getRoundName(tournament.currentRound, totalRounds)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-mono">
              <span className="text-gray-500">PRIZE POOL:</span>{" "}
              <span className="text-yellow-400">{tournament.totalPrizePool.toLocaleString()} ARENA</span>
            </div>
            <button
              onClick={() => setShowPredictions(!showPredictions)}
              className={`text-xs font-mono px-3 py-1 rounded border transition-colors ${
                showPredictions
                  ? "border-pink-500/30 text-pink-400 bg-pink-500/10"
                  : "border-gray-700 text-gray-500"
              }`}
            >
              📊 ODDS
            </button>
          </div>
        </div>
      </div>

      {/* Bracket visualization */}
      <div className="container py-6">
        <div className="flex items-center justify-center gap-8 overflow-x-auto pb-4">
          {tournament.rounds.map((round, ri) => (
            <div key={ri} className="flex flex-col items-center gap-2 shrink-0">
              {/* Round header */}
              <div
                className={`text-xs font-mono px-3 py-1 rounded-full border mb-2 ${
                  round.status === "active"
                    ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
                    : round.status === "complete"
                    ? "border-green-500/30 text-green-400/60"
                    : "border-gray-700 text-gray-600"
                }`}
              >
                {getRoundName(round.number, totalRounds)}
              </div>

              {/* Matches */}
              <div
                className="flex flex-col gap-4 justify-center"
                style={{ minHeight: `${tournament.size * 3}rem` }}
              >
                {round.matches.map((match, mi) => {
                  const isCurrentMatch =
                    round.number === tournament.currentRound &&
                    mi === tournament.currentMatchIndex;
                  return (
                    <div
                      key={match.id}
                      className="flex items-center"
                      style={{
                        marginTop: ri > 0 ? `${Math.pow(2, ri) * 0.5}rem` : 0,
                        marginBottom: ri > 0 ? `${Math.pow(2, ri) * 0.5}rem` : 0,
                      }}
                    >
                      <MatchCard
                        match={match}
                        roundName={getRoundName(round.number, totalRounds)}
                        isActive={isCurrentMatch && tournament.status === "in_progress"}
                        onStart={() => onStartMatch(match)}
                      />
                      {/* Connector lines */}
                      {ri < tournament.rounds.length - 1 && (
                        <div className="w-8 h-0.5 bg-gray-800 ml-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Champion display */}
          {tournament.champion && (
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="text-xs font-mono px-3 py-1 rounded-full border border-yellow-500/50 text-yellow-400 bg-yellow-500/10 mb-2">
                CHAMPION
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-44 p-3 rounded-lg border-2 border-yellow-500/50 bg-gradient-to-b from-yellow-500/10 to-transparent text-center"
              >
                <div className="text-2xl mb-1">🏆</div>
                <div
                  className="text-sm font-mono font-bold"
                  style={{ color: tournament.champion.color }}
                >
                  {tournament.champion.name}
                </div>
                <div className="text-xs text-gray-400 mt-1 font-mono">
                  {tournament.champion.wins}W-{tournament.champion.losses}L •{" "}
                  {tournament.champion.totalKills} KILLS
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Round complete — advance button */}
        {tournament.status === "round_complete" && (
          <div className="text-center mt-6">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={onStartNextRound}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 font-mono hover:from-cyan-500/30 hover:to-pink-500/30 transition-all"
            >
              ▶ ADVANCE TO {getRoundName(tournament.currentRound + 1, totalRounds)}
            </motion.button>
          </div>
        )}
      </div>

      {/* Prediction market sidebar */}
      <AnimatePresence>
        {showPredictions && currentRound && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed right-4 top-20 w-64 bg-black/90 border border-pink-500/20 rounded-lg overflow-hidden z-20"
          >
            <div className="px-3 py-2 bg-pink-500/10 border-b border-pink-500/20">
              <div className="text-xs font-mono text-pink-400">
                PREDICTION MARKET — {getRoundName(tournament.currentRound, totalRounds)}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                Pool: {currentRound.totalPool.toLocaleString()} ARENA
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {currentRound.predictions
                .sort((a, b) => a.odds - b.odds)
                .map((pred) => {
                  const agent = tournament.agents.find(a => a.id === pred.agentId);
                  if (!agent || agent.eliminated) return null;
                  return (
                    <div
                      key={pred.agentId}
                      className="px-3 py-2 border-b border-gray-800/50 hover:bg-gray-900/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agent.color }}
                          />
                          <span className="text-xs font-mono" style={{ color: agent.color }}>
                            {agent.name}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-yellow-400">
                          {pred.odds.toFixed(1)}:1
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-500 font-mono">
                          {pred.bets} bets
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {pred.totalWagered} ARENA
                        </span>
                      </div>
                      {/* Odds bar */}
                      <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (1 / pred.odds) * 100)}%`,
                            backgroundColor: agent.color,
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent standings */}
      <div className="container pb-8">
        <h3 className="text-sm font-mono text-gray-400 mb-3 tracking-wider">STANDINGS</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {tournament.agents
            .sort((a, b) => {
              if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
              return b.wins - a.wins || b.totalKills - a.totalKills;
            })
            .map((agent, i) => (
              <div
                key={agent.id}
                className={`p-2 rounded border font-mono text-xs transition-all ${
                  agent.eliminated
                    ? "border-gray-800 bg-gray-900/30 opacity-40"
                    : tournament.champion?.id === agent.id
                    ? "border-yellow-500/50 bg-yellow-500/5"
                    : "border-gray-800 bg-black/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span style={{ color: agent.color }}>
                    {tournament.champion?.id === agent.id && "🏆 "}
                    {agent.name}
                  </span>
                  <span className="text-gray-600">#{agent.seed}</span>
                </div>
                <div className="flex gap-2 text-[10px] text-gray-500">
                  <span className="text-green-400">{agent.wins}W</span>
                  <span className="text-red-400">{agent.losses}L</span>
                  <span>{agent.totalKills}K</span>
                </div>
                {agent.eliminated && (
                  <div className="text-[10px] text-red-500 mt-1">ELIMINATED</div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

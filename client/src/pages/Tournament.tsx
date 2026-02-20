/**
 * Tournament Page — Multi-round elimination tournament with bracket visualization
 * and integrated prediction markets.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useGame } from "@/contexts/GameContext";
import { motion, AnimatePresence } from "framer-motion";
import TournamentBracket from "@/components/TournamentBracket";
import AgentCustomizer, { type PersonalityWeights } from "@/components/AgentCustomizer";
import {
  type Tournament as TournamentType,
  type TournamentSize,
  type BracketMatch,
  createTournament,
  resolveMatch,
  startNextRound,
  getCurrentMatch,
  getRoundName,
  saveTournament,
  loadTournament,
  clearTournament,
} from "@/lib/tournamentEngine";

type TournamentView = "setup" | "bracket" | "match" | "customize";

export default function Tournament() {
  const [, navigate] = useLocation();
  const { state, dispatch, startMatch } = useGame();
  const [tournament, setTournament] = useState<TournamentType | null>(null);
  const [view, setView] = useState<TournamentView>("setup");
  const [selectedSize, setSelectedSize] = useState<TournamentSize>(8);
  const [tournamentName, setTournamentName] = useState("");
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [matchResult, setMatchResult] = useState<{ winnerId: string; kills: { agent1: number; agent2: number }; duration: number } | null>(null);
  const matchSimulating = useRef(false);

  // Load saved tournament on mount
  useEffect(() => {
    const saved = loadTournament();
    if (saved && saved.status !== "finished") {
      setTournament(saved);
      setView("bracket");
    }
  }, []);

  // Create new tournament
  const handleCreate = useCallback(() => {
    const t = createTournament(selectedSize, tournamentName || undefined);
    setTournament(t);
    saveTournament(t);
    setView("bracket");
  }, [selectedSize, tournamentName]);

  // Start a bracket match (simulated AI vs AI)
  const handleStartMatch = useCallback((match: BracketMatch) => {
    if (!match.agent1 || !match.agent2 || matchSimulating.current) return;
    matchSimulating.current = true;
    setView("match");

    // Simulate the match with a timer
    const duration = 15 + Math.random() * 30; // 15-45 seconds simulated
    const agent1Kills = Math.floor(Math.random() * 5) + 1;
    const agent2Kills = Math.floor(Math.random() * 5) + 1;

    // Determine winner based on "power" — more kills = more likely to win
    const agent1Power = agent1Kills + Math.random() * 3;
    const agent2Power = agent2Kills + Math.random() * 3;
    const winnerId = agent1Power >= agent2Power ? match.agent1.id : match.agent2.id;

    // Simulate with a delay for dramatic effect
    setTimeout(() => {
      setMatchResult({
        winnerId,
        kills: { agent1: agent1Kills, agent2: agent2Kills },
        duration: Math.floor(duration),
      });
      matchSimulating.current = false;
    }, 3000 + Math.random() * 2000);
  }, []);

  // Apply match result to tournament
  const handleConfirmResult = useCallback(() => {
    if (!tournament || !matchResult) return;
    const updated = resolveMatch(tournament, matchResult.winnerId, matchResult.kills, matchResult.duration);
    setTournament(updated);
    saveTournament(updated);
    setMatchResult(null);
    setView("bracket");
  }, [tournament, matchResult]);

  // Advance to next round
  const handleNextRound = useCallback(() => {
    if (!tournament) return;
    const updated = startNextRound(tournament);
    setTournament(updated);
    saveTournament(updated);
  }, [tournament]);

  // New tournament
  const handleNewTournament = useCallback(() => {
    clearTournament();
    setTournament(null);
    setView("setup");
  }, []);

  const currentMatch = tournament ? getCurrentMatch(tournament) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Setup Screen */}
      {view === "setup" && (
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full mx-4"
          >
            <div className="text-center mb-8">
              <h1 className="font-mono text-3xl text-cyan-400 tracking-wider mb-2">
                TOURNAMENT MODE
              </h1>
              <p className="text-sm text-gray-500 font-mono">
                Multi-round elimination brackets with prediction markets
              </p>
            </div>

            <div className="bg-black/60 border border-cyan-500/20 rounded-xl p-6 space-y-6">
              {/* Tournament name */}
              <div>
                <label className="text-xs font-mono text-gray-400 block mb-2">TOURNAMENT NAME</label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value.toUpperCase())}
                  placeholder="ARENA CHAMPIONSHIP"
                  className="w-full bg-transparent border border-gray-700 rounded px-3 py-2 text-sm font-mono text-cyan-400 focus:border-cyan-500/50 focus:outline-none placeholder:text-gray-700"
                  maxLength={32}
                />
              </div>

              {/* Size selection */}
              <div>
                <label className="text-xs font-mono text-gray-400 block mb-2">BRACKET SIZE</label>
                <div className="grid grid-cols-3 gap-2">
                  {([4, 8, 16] as TournamentSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`p-3 rounded-lg border font-mono text-center transition-all ${
                        selectedSize === size
                          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                          : "border-gray-800 text-gray-500 hover:border-gray-700"
                      }`}
                    >
                      <div className="text-lg font-bold">{size}</div>
                      <div className="text-[10px] text-gray-600">
                        {Math.log2(size)} rounds
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                <div className="text-[10px] font-mono text-gray-500 space-y-1">
                  <div>▸ {selectedSize} AI agents compete in single-elimination</div>
                  <div>▸ {Math.log2(selectedSize)} rounds to determine the champion</div>
                  <div>▸ Prediction markets open each round</div>
                  <div>▸ Customize agent personalities before matches</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/arena")}
                  className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-500 font-mono text-sm hover:border-gray-600 transition-colors"
                >
                  ← BACK
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 py-2 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 font-mono text-sm hover:from-cyan-500/30 hover:to-pink-500/30 transition-all"
                >
                  CREATE TOURNAMENT →
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bracket View */}
      {view === "bracket" && tournament && (
        <div>
          <TournamentBracket
            tournament={tournament}
            onStartMatch={handleStartMatch}
            onStartNextRound={handleNextRound}
            onClose={() => navigate("/arena")}
          />

          {/* Bottom actions */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-30">
            {tournament.status === "finished" && (
              <button
                onClick={handleNewTournament}
                className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 font-mono text-xs hover:bg-cyan-500/30 transition-colors"
              >
                NEW TOURNAMENT
              </button>
            )}
          </div>
        </div>
      )}

      {/* Match Simulation View */}
      {view === "match" && tournament && currentMatch && (
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg w-full mx-4"
          >
            <div className="bg-black/80 border border-cyan-500/20 rounded-xl p-6 text-center">
              <div className="text-xs font-mono text-gray-500 mb-4">
                {getRoundName(tournament.currentRound, tournament.rounds.length)} — MATCH {tournament.currentMatchIndex + 1}
              </div>

              {/* VS Display */}
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-mono font-bold mb-2"
                    style={{
                      borderColor: currentMatch.agent1?.color || "#333",
                      color: currentMatch.agent1?.color || "#333",
                      backgroundColor: (currentMatch.agent1?.color || "#333") + "15",
                    }}
                  >
                    {currentMatch.agent1?.name.charAt(0)}
                  </div>
                  <div className="text-sm font-mono" style={{ color: currentMatch.agent1?.color }}>
                    {currentMatch.agent1?.name}
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono">
                    #{currentMatch.agent1?.seed}
                  </div>
                </div>

                <div className="text-2xl font-mono text-gray-600">VS</div>

                <div className="text-center">
                  <div
                    className="w-16 h-16 rounded-full border-2 flex items-center justify-center text-2xl font-mono font-bold mb-2"
                    style={{
                      borderColor: currentMatch.agent2?.color || "#333",
                      color: currentMatch.agent2?.color || "#333",
                      backgroundColor: (currentMatch.agent2?.color || "#333") + "15",
                    }}
                  >
                    {currentMatch.agent2?.name.charAt(0)}
                  </div>
                  <div className="text-sm font-mono" style={{ color: currentMatch.agent2?.color }}>
                    {currentMatch.agent2?.name}
                  </div>
                  <div className="text-[10px] text-gray-600 font-mono">
                    #{currentMatch.agent2?.seed}
                  </div>
                </div>
              </div>

              {/* Simulating or Result */}
              <AnimatePresence mode="wait">
                {!matchResult ? (
                  <motion.div
                    key="simulating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
                      <span className="text-sm font-mono text-cyan-400 animate-pulse">
                        SIMULATING COMBAT...
                      </span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full animate-pulse" style={{ width: "100%" }} />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {/* Winner announcement */}
                    <div className="mb-4">
                      <div className="text-xs font-mono text-gray-500 mb-1">WINNER</div>
                      <div
                        className="text-2xl font-mono font-bold"
                        style={{
                          color: matchResult.winnerId === currentMatch.agent1?.id
                            ? currentMatch.agent1?.color
                            : currentMatch.agent2?.color,
                        }}
                      >
                        {matchResult.winnerId === currentMatch.agent1?.id
                          ? currentMatch.agent1?.name
                          : currentMatch.agent2?.name}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4 text-xs font-mono">
                      <div>
                        <div className="text-gray-500">KILLS</div>
                        <div className="text-gray-300">
                          {matchResult.kills.agent1} - {matchResult.kills.agent2}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">DURATION</div>
                        <div className="text-gray-300">{matchResult.duration}s</div>
                      </div>
                      <div>
                        <div className="text-gray-500">ROUND</div>
                        <div className="text-gray-300">
                          {getRoundName(tournament.currentRound, tournament.rounds.length)}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleConfirmResult}
                      className="px-6 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 font-mono text-sm hover:bg-cyan-500/30 transition-colors"
                    >
                      CONTINUE →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}

      {/* Agent Customizer Overlay */}
      <AnimatePresence>
        {showCustomizer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          >
            <AgentCustomizer
              onApply={(weights, name) => {
                setShowCustomizer(false);
                // Weights will be applied to the next match's agents
              }}
              onClose={() => setShowCustomizer(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

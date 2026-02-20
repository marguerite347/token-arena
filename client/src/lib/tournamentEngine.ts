/**
 * Tournament Engine — Multi-round elimination brackets with prediction markets
 * 
 * Supports 4, 8, or 16 agent tournaments with single-elimination brackets.
 * Each round has its own prediction market that carries forward.
 */

export type TournamentSize = 4 | 8 | 16;
export type TournamentStatus = "setup" | "in_progress" | "round_complete" | "finished";
export type MatchStatus = "pending" | "in_progress" | "complete";

export interface TournamentAgent {
  id: string;
  name: string;
  color: string;
  seed: number;
  wins: number;
  losses: number;
  totalKills: number;
  totalDamage: number;
  tokensEarned: number;
  eliminated: boolean;
  personalityWeights?: PersonalityWeights;
}

export interface PersonalityWeights {
  aggression: number;
  caution: number;
  greed: number;
  creativity: number;
}

export interface BracketMatch {
  id: string;
  round: number;
  position: number; // Position within the round
  agent1: TournamentAgent | null;
  agent2: TournamentAgent | null;
  winner: TournamentAgent | null;
  status: MatchStatus;
  kills: { agent1: number; agent2: number };
  duration: number;
}

export interface TournamentPrediction {
  agentId: string;
  agentName: string;
  bets: number;
  odds: number;
  totalWagered: number;
}

export interface TournamentRound {
  number: number;
  matches: BracketMatch[];
  predictions: TournamentPrediction[];
  totalPool: number;
  status: "pending" | "active" | "complete";
}

export interface Tournament {
  id: string;
  name: string;
  size: TournamentSize;
  status: TournamentStatus;
  agents: TournamentAgent[];
  rounds: TournamentRound[];
  currentRound: number;
  currentMatchIndex: number;
  champion: TournamentAgent | null;
  totalPrizePool: number;
  startTime: number;
  cumulativePredictions: Map<string, number>; // agentId -> total bets across rounds
}

// ─── Agent Names & Colors ───────────────────────────────────────────────────
const TOURNAMENT_NAMES = [
  "NEXUS-7", "CIPHER-X", "VORTEX-3", "PHANTOM-9",
  "STRIKER-1", "ECHO-5", "BLAZE-2", "SHADOW-8",
  "OMEGA-4", "PULSE-6", "NOVA-11", "WRAITH-0",
  "TITAN-12", "FLUX-13", "APEX-14", "ZERO-15",
];

const TOURNAMENT_COLORS = [
  "#FF00AA", "#39FF14", "#FFB800", "#FF3333",
  "#AA00FF", "#FF6600", "#00FF88", "#FF0066",
  "#00CCFF", "#FF4488", "#88FF00", "#FF8800",
  "#4400FF", "#FF0044", "#00FF44", "#FFCC00",
];

// ─── Tournament Creation ────────────────────────────────────────────────────
export function createTournament(size: TournamentSize, name?: string): Tournament {
  const agents: TournamentAgent[] = [];
  for (let i = 0; i < size; i++) {
    agents.push({
      id: `t-agent-${i}`,
      name: TOURNAMENT_NAMES[i % TOURNAMENT_NAMES.length],
      color: TOURNAMENT_COLORS[i % TOURNAMENT_COLORS.length],
      seed: i + 1,
      wins: 0,
      losses: 0,
      totalKills: 0,
      totalDamage: 0,
      tokensEarned: 0,
      eliminated: false,
    });
  }

  // Shuffle for seeding
  const shuffled = [...agents].sort(() => Math.random() - 0.5);
  shuffled.forEach((a, i) => { a.seed = i + 1; });

  const totalRounds = Math.log2(size);
  const rounds: TournamentRound[] = [];

  // Generate first round matches
  const firstRoundMatches: BracketMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    firstRoundMatches.push({
      id: `match-1-${i}`,
      round: 1,
      position: i,
      agent1: shuffled[i * 2],
      agent2: shuffled[i * 2 + 1],
      winner: null,
      status: "pending",
      kills: { agent1: 0, agent2: 0 },
      duration: 0,
    });
  }

  // Generate initial predictions for first round
  const predictions = shuffled.map(a => ({
    agentId: a.id,
    agentName: a.name,
    bets: Math.floor(Math.random() * 50) + 10,
    odds: 2 + Math.random() * 6,
    totalWagered: Math.floor(Math.random() * 200) + 50,
  }));

  rounds.push({
    number: 1,
    matches: firstRoundMatches,
    predictions,
    totalPool: predictions.reduce((sum, p) => sum + p.totalWagered, 0),
    status: "active",
  });

  // Generate placeholder rounds
  for (let r = 2; r <= totalRounds; r++) {
    const matchCount = size / Math.pow(2, r);
    const matches: BracketMatch[] = [];
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        id: `match-${r}-${i}`,
        round: r,
        position: i,
        agent1: null,
        agent2: null,
        winner: null,
        status: "pending",
        kills: { agent1: 0, agent2: 0 },
        duration: 0,
      });
    }
    rounds.push({
      number: r,
      matches,
      predictions: [],
      totalPool: 0,
      status: "pending",
    });
  }

  return {
    id: `tournament-${Date.now()}`,
    name: name || `ARENA CHAMPIONSHIP ${new Date().toLocaleDateString()}`,
    size,
    status: "in_progress",
    agents: shuffled,
    rounds,
    currentRound: 1,
    currentMatchIndex: 0,
    champion: null,
    totalPrizePool: predictions.reduce((sum, p) => sum + p.totalWagered, 0),
    startTime: Date.now(),
    cumulativePredictions: new Map(),
  };
}

// ─── Match Resolution ───────────────────────────────────────────────────────
export function resolveMatch(
  tournament: Tournament,
  winnerId: string,
  kills: { agent1: number; agent2: number },
  duration: number,
): Tournament {
  const t = { ...tournament };
  const round = t.rounds[t.currentRound - 1];
  const match = round.matches[t.currentMatchIndex];

  if (!match.agent1 || !match.agent2) return t;

  // Determine winner and loser
  const winner = winnerId === match.agent1.id ? match.agent1 : match.agent2;
  const loser = winnerId === match.agent1.id ? match.agent2 : match.agent1;

  match.winner = winner;
  match.status = "complete";
  match.kills = kills;
  match.duration = duration;

  // Update agent stats
  winner.wins++;
  winner.totalKills += winnerId === match.agent1.id ? kills.agent1 : kills.agent2;
  loser.losses++;
  loser.eliminated = true;
  loser.totalKills += winnerId === match.agent1.id ? kills.agent2 : kills.agent1;

  // Advance to next match or next round
  if (t.currentMatchIndex < round.matches.length - 1) {
    t.currentMatchIndex++;
    round.matches[t.currentMatchIndex].status = "in_progress";
  } else {
    // Round complete
    round.status = "complete";
    t.status = "round_complete";

    // Advance winners to next round
    if (t.currentRound < t.rounds.length) {
      const nextRound = t.rounds[t.currentRound];
      const roundWinners = round.matches.map(m => m.winner!);

      for (let i = 0; i < nextRound.matches.length; i++) {
        nextRound.matches[i].agent1 = roundWinners[i * 2] || null;
        nextRound.matches[i].agent2 = roundWinners[i * 2 + 1] || null;
      }

      // Generate predictions for next round
      const remainingAgents = t.agents.filter(a => !a.eliminated);
      nextRound.predictions = remainingAgents.map(a => {
        const prevPred = round.predictions.find(p => p.agentId === a.id);
        const winBonus = a.wins * 0.5;
        return {
          agentId: a.id,
          agentName: a.name,
          bets: Math.floor(Math.random() * 80) + 20,
          odds: Math.max(1.2, (prevPred?.odds || 4) - winBonus + (Math.random() - 0.5) * 2),
          totalWagered: Math.floor(Math.random() * 400) + 100,
        };
      });
      nextRound.totalPool = nextRound.predictions.reduce((sum, p) => sum + p.totalWagered, 0);
      t.totalPrizePool += nextRound.totalPool;
    } else {
      // Tournament over
      t.champion = winner;
      t.status = "finished";
    }
  }

  return t;
}

// ─── Start Next Round ───────────────────────────────────────────────────────
export function startNextRound(tournament: Tournament): Tournament {
  const t = { ...tournament };
  if (t.currentRound >= t.rounds.length) return t;

  t.currentRound++;
  t.currentMatchIndex = 0;
  t.status = "in_progress";

  const round = t.rounds[t.currentRound - 1];
  round.status = "active";
  if (round.matches.length > 0) {
    round.matches[0].status = "in_progress";
  }

  return t;
}

// ─── Get Current Match ──────────────────────────────────────────────────────
export function getCurrentMatch(tournament: Tournament): BracketMatch | null {
  if (tournament.status === "finished") return null;
  const round = tournament.rounds[tournament.currentRound - 1];
  if (!round) return null;
  return round.matches[tournament.currentMatchIndex] || null;
}

// ─── Get Round Name ─────────────────────────────────────────────────────────
export function getRoundName(round: number, totalRounds: number): string {
  if (round === totalRounds) return "GRAND FINAL";
  if (round === totalRounds - 1) return "SEMI-FINALS";
  if (round === totalRounds - 2) return "QUARTER-FINALS";
  return `ROUND ${round}`;
}

// ─── Tournament Storage ─────────────────────────────────────────────────────
const TOURNAMENT_STORAGE_KEY = "token-arena-tournament";

export function saveTournament(tournament: Tournament): void {
  try {
    // Convert Map to array for serialization
    const serializable = {
      ...tournament,
      cumulativePredictions: Array.from(tournament.cumulativePredictions.entries()),
    };
    localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Storage full
  }
}

export function loadTournament(): Tournament | null {
  try {
    const raw = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    parsed.cumulativePredictions = new Map(parsed.cumulativePredictions || []);
    return parsed;
  } catch {
    return null;
  }
}

export function clearTournament(): void {
  localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
}

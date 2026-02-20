/**
 * PredictionTicker — Bloomberg-terminal-style scrolling ticker for live match events
 * 
 * Streams across the arena view during combat. Updates on:
 * - Bets placed, agent deaths, weapons crafted, odds shifts
 * - Live pot display and odds updates
 * - Agent eliminations and remaining count
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGame, type Agent } from "@/contexts/GameContext";
import { motion, AnimatePresence } from "framer-motion";

interface TickerItem {
  id: string;
  text: string;
  type: "bet" | "kill" | "weapon" | "odds" | "pot" | "system" | "craft" | "critical";
  timestamp: number;
  color: string;
}

// Simulated betting odds engine
function calculateOdds(agents: Agent[], player: Agent, mode: string): Map<string, number> {
  const odds = new Map<string, number>();
  const alive = agents.filter(a => a.isAlive);
  const allFighters = mode === "pvai" && player.isAlive ? [player, ...alive] : alive;
  const total = allFighters.length;
  if (total === 0) return odds;

  for (const fighter of allFighters) {
    const healthFactor = fighter.health / fighter.maxHealth;
    const killFactor = 1 + fighter.kills * 0.3;
    const tokenFactor = Math.min(2, fighter.tokens / 100);
    const weaponFactor = fighter.weapon.damage / 15; // Normalize to plasma
    const raw = healthFactor * killFactor * tokenFactor * weaponFactor;
    odds.set(fighter.id, raw);
  }

  // Normalize to betting odds
  const totalRaw = Array.from(odds.values()).reduce((s, v) => s + v, 0);
  odds.forEach((raw, id) => {
    odds.set(id, Math.max(1.1, totalRaw / raw));
  });

  return odds;
}

// Simulated bet amounts
const BET_NAMES = ["CryptoWhale", "DeFiDegen", "TokenMaxi", "NeonTrader", "VoidSpeculator", "ChainRunner", "BlockBaron", "HashHunter"];
const BET_TOKENS = ["ARENA", "PLAS", "TKN", "VOID"];

export default function PredictionTicker() {
  const { state } = useGame();
  const [items, setItems] = useState<TickerItem[]>([]);
  const [livePot, setLivePot] = useState(0);
  const prevKillsRef = useRef(new Map<string, number>());
  const prevWeaponsRef = useRef(new Map<string, string>());
  const prevAliveRef = useRef(0);
  const tickerRef = useRef<HTMLDivElement>(null);
  const lastBetTime = useRef(0);
  const lastOddsTime = useRef(0);

  const addItem = useCallback((item: Omit<TickerItem, "id" | "timestamp">) => {
    setItems(prev => {
      const newItem: TickerItem = {
        ...item,
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
      };
      // Keep last 30 items
      return [...prev.slice(-29), newItem];
    });
  }, []);

  // Track kills
  useEffect(() => {
    if (state.phase !== "combat") return;

    for (const agent of state.agents) {
      const prevKills = prevKillsRef.current.get(agent.id) || 0;
      if (agent.kills > prevKills) {
        const alive = state.agents.filter(a => a.isAlive).length + (state.player.isAlive ? 1 : 0);
        addItem({
          text: `${agent.name} ELIMINATED target — ${alive} agents remain`,
          type: "kill",
          color: agent.color,
        });
      }
      prevKillsRef.current.set(agent.id, agent.kills);
    }

    // Player kills
    const prevPlayerKills = prevKillsRef.current.get("player") || 0;
    if (state.player.kills > prevPlayerKills) {
      addItem({
        text: `PLAYER scores elimination! K/D: ${state.player.kills}/${state.player.isAlive ? 0 : 1}`,
        type: "kill",
        color: "#00F0FF",
      });
    }
    prevKillsRef.current.set("player", state.player.kills);
  }, [state.agents, state.player.kills, state.phase, addItem]);

  // Track weapon switches
  useEffect(() => {
    if (state.phase !== "combat") return;

    for (const agent of state.agents) {
      if (!agent.isAlive) continue;
      const prevWeapon = prevWeaponsRef.current.get(agent.id);
      if (prevWeapon && prevWeapon !== agent.weapon.type) {
        addItem({
          text: `${agent.name} switched to [${agent.weapon.name.toUpperCase()}]`,
          type: "weapon",
          color: agent.weapon.color,
        });
      }
      prevWeaponsRef.current.set(agent.id, agent.weapon.type);
    }
  }, [state.agents, state.phase, addItem]);

  // Track eliminations (alive count changes)
  useEffect(() => {
    if (state.phase !== "combat") return;
    const alive = state.agents.filter(a => a.isAlive).length;
    if (prevAliveRef.current > 0 && alive < prevAliveRef.current) {
      if (alive <= 2) {
        addItem({
          text: `FINAL ${alive + (state.player.isAlive ? 1 : 0)} — ENDGAME APPROACHING`,
          type: "critical",
          color: "#FF3333",
        });
      }
    }
    prevAliveRef.current = alive;
  }, [state.agents, state.phase, state.player.isAlive, addItem]);

  // Simulated bets and odds updates
  useEffect(() => {
    if (state.phase !== "combat") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const alive = state.agents.filter(a => a.isAlive);
      if (alive.length === 0) return;

      // Random bet placement
      if (now - lastBetTime.current > 3000 + Math.random() * 5000) {
        lastBetTime.current = now;
        const bettor = BET_NAMES[Math.floor(Math.random() * BET_NAMES.length)];
        const target = alive[Math.floor(Math.random() * alive.length)];
        const amount = Math.floor(10 + Math.random() * 90);
        const token = BET_TOKENS[Math.floor(Math.random() * BET_TOKENS.length)];
        setLivePot(prev => prev + amount);
        addItem({
          text: `${bettor} wagered ${amount} ${token} on ${target.name}`,
          type: "bet",
          color: "#FFB800",
        });
      }

      // Odds update
      if (now - lastOddsTime.current > 6000 + Math.random() * 8000) {
        lastOddsTime.current = now;
        const odds = calculateOdds(state.agents, state.player, state.mode);
        const topTwo = alive.sort((a, b) => (odds.get(a.id) || 99) - (odds.get(b.id) || 99)).slice(0, 2);
        if (topTwo.length >= 2) {
          const o1 = (odds.get(topTwo[0].id) || 2).toFixed(1);
          const o2 = (odds.get(topTwo[1].id) || 2).toFixed(1);
          addItem({
            text: `${topTwo[0].name} vs ${topTwo[1].name} — ${topTwo[0].name} favored ${o1}:1 ... odds shifting`,
            type: "odds",
            color: "#AA00FF",
          });
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [state.phase, state.agents, state.player, state.mode, addItem]);

  // Live pot display
  useEffect(() => {
    if (state.phase !== "combat") return;
    const interval = setInterval(() => {
      if (livePot > 0) {
        addItem({
          text: `LIVE POT: ${livePot.toLocaleString()} ARENA — ${state.agents.filter(a => a.isAlive).length + (state.player.isAlive ? 1 : 0)} fighters remaining`,
          type: "pot",
          color: "#39FF14",
        });
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [state.phase, livePot, state.agents, state.player.isAlive, addItem]);

  // Match start
  useEffect(() => {
    if (state.phase === "combat") {
      setItems([]);
      setLivePot(Math.floor(100 + Math.random() * 200));
      prevKillsRef.current.clear();
      prevWeaponsRef.current.clear();
      prevAliveRef.current = state.agents.filter(a => a.isAlive).length;
      addItem({
        text: `MATCH LIVE — ${state.agents.length + (state.mode === "pvai" ? 1 : 0)} combatants — Prediction market OPEN`,
        type: "system",
        color: "#00F0FF",
      });
    }
  }, [state.phase]);

  // Only show during combat
  if (state.phase !== "combat") return null;

  // Get the last 5 items for display
  const visibleItems = items.slice(-5);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 pointer-events-none">
      {/* Ticker bar */}
      <div className="bg-black/80 border-t border-neon-cyan/30 backdrop-blur-sm">
        <div className="flex items-center h-7 overflow-hidden">
          {/* Label */}
          <div className="flex-shrink-0 px-3 bg-neon-cyan/20 h-full flex items-center border-r border-neon-cyan/30">
            <span className="font-mono text-[9px] font-bold text-neon-cyan tracking-wider">LIVE</span>
          </div>

          {/* Scrolling ticker */}
          <div className="flex-1 overflow-hidden relative" ref={tickerRef}>
            <motion.div
              className="flex items-center gap-6 whitespace-nowrap"
              animate={{ x: [0, -2000] }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            >
              {/* Double the items for seamless loop */}
              {[...visibleItems, ...visibleItems, ...items.slice(-10)].map((item, i) => (
                <span
                  key={`${item.id}-${i}`}
                  className="inline-flex items-center gap-1.5 font-mono text-[10px]"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className={`${
                      item.type === "kill" ? "text-red-400" :
                      item.type === "bet" ? "text-yellow-400" :
                      item.type === "odds" ? "text-purple-400" :
                      item.type === "pot" ? "text-neon-green" :
                      item.type === "weapon" ? "text-neon-cyan" :
                      item.type === "critical" ? "text-red-500 font-bold" :
                      "text-foreground/70"
                    }`}
                  >
                    {item.text}
                  </span>
                  <span className="text-muted-foreground/30">|</span>
                </span>
              ))}
            </motion.div>
          </div>

          {/* Live pot */}
          <div className="flex-shrink-0 px-3 bg-neon-green/10 h-full flex items-center border-l border-neon-green/30 gap-2">
            <span className="font-mono text-[9px] text-neon-green/70">POT</span>
            <span className="font-display text-xs text-neon-green font-bold">{livePot.toLocaleString()}</span>
            <span className="font-mono text-[8px] text-neon-green/50">ARENA</span>
          </div>
        </div>
      </div>

      {/* Recent events feed (top-right corner, stacked) */}
      <div className="fixed top-16 right-4 z-10 pointer-events-none w-80">
        <AnimatePresence mode="popLayout">
          {items.slice(-4).map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 50, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 50, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-1"
            >
              <div className="bg-black/70 backdrop-blur-sm border-l-2 px-2 py-1 font-mono text-[9px]"
                style={{ borderColor: item.color }}>
                <span style={{ color: item.color }}>{item.text}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

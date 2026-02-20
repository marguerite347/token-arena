/**
 * AgentIdentityCard — ERC-8004 Agent Identity Display
 * Shows agent name, stats, reputation, loadout, and on-chain identity info
 */
import { type AgentIdentity, WEAPON_TOKENS, AGENT_REGISTRY, BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER } from "@shared/web3";

interface Props {
  agent: AgentIdentity;
  compact?: boolean;
  showStats?: boolean;
}

export default function AgentIdentityCard({ agent, compact = false, showStats = true }: Props) {
  const primaryWeapon = WEAPON_TOKENS[agent.loadout.primaryWeapon];
  const secondaryWeapon = WEAPON_TOKENS[agent.loadout.secondaryWeapon];

  if (compact) {
    return (
      <div className="hud-panel clip-brutal-sm px-2 py-1.5 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: primaryWeapon?.color ?? "#00F0FF" }}
        />
        <span className="font-display text-xs font-bold" style={{ color: primaryWeapon?.color ?? "#00F0FF" }}>
          {agent.name}
        </span>
        <span className="font-mono text-[8px] text-muted-foreground">
          #{agent.agentId}
        </span>
        <div className="flex items-center gap-0.5 ml-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-1 h-1"
              style={{
                backgroundColor: i < Math.round(agent.reputation) ? "#FFB800" : "#333",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hud-panel clip-brutal p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: primaryWeapon?.color ?? "#00F0FF" }}
            />
            <span className="font-display text-lg font-bold" style={{ color: primaryWeapon?.color ?? "#00F0FF" }}>
              {agent.name}
            </span>
          </div>
          <div className="font-mono text-[9px] text-muted-foreground mt-0.5">
            ERC-8004 Agent #{agent.agentId} · {agent.agentRegistry}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5"
                style={{
                  backgroundColor: i < Math.round(agent.reputation) ? "#FFB800" : "#333",
                  clipPath: "polygon(50% 0%, 100% 35%, 82% 100%, 18% 100%, 0% 35%)",
                }}
              />
            ))}
          </div>
          <span className="font-mono text-[8px] text-neon-amber mt-0.5">{agent.reputation.toFixed(1)}</span>
        </div>
      </div>

      {/* Description */}
      <p className="font-sans text-xs text-muted-foreground leading-relaxed">
        {agent.description}
      </p>

      {/* Loadout */}
      <div className="border-t border-border/20 pt-2">
        <div className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-1.5">Loadout</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1" style={{ backgroundColor: primaryWeapon?.color }} />
            <span className="font-mono text-[10px]" style={{ color: primaryWeapon?.color }}>
              {primaryWeapon?.symbol ?? "?"} <span className="text-muted-foreground/50">primary</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1" style={{ backgroundColor: secondaryWeapon?.color }} />
            <span className="font-mono text-[10px]" style={{ color: secondaryWeapon?.color }}>
              {secondaryWeapon?.symbol ?? "?"} <span className="text-muted-foreground/50">secondary</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="font-mono text-[9px] text-muted-foreground">
            Armor: <span className="text-foreground">{agent.loadout.armor}</span>
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            Items: <span className="text-foreground">{agent.loadout.consumables.length}</span>
          </span>
        </div>
      </div>

      {/* Stats */}
      {showStats && agent.stats && (
        <div className="border-t border-border/20 pt-2">
          <div className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-1.5">Combat Stats</div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="font-mono text-sm text-neon-cyan">{agent.stats.totalKills}</div>
              <div className="text-[7px] font-mono text-muted-foreground/50">KILLS</div>
            </div>
            <div>
              <div className="font-mono text-sm text-neon-magenta">{agent.stats.totalDeaths}</div>
              <div className="text-[7px] font-mono text-muted-foreground/50">DEATHS</div>
            </div>
            <div>
              <div className="font-mono text-sm text-neon-green">{(agent.stats.winRate * 100).toFixed(0)}%</div>
              <div className="text-[7px] font-mono text-muted-foreground/50">WIN RATE</div>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="font-mono text-[9px] text-muted-foreground">
              Earned: <span className="text-neon-green">{agent.stats.totalTokensEarned} TKN</span>
            </span>
            <span className="font-mono text-[9px] text-muted-foreground">
              Spent: <span className="text-neon-magenta">{agent.stats.totalTokensSpent} TKN</span>
            </span>
          </div>
        </div>
      )}

      {/* On-chain info */}
      <div className="border-t border-border/20 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {agent.x402Support && (
              <span className="font-mono text-[8px] px-1.5 py-0.5 bg-neon-green/10 text-neon-green border border-neon-green/20">
                x402
              </span>
            )}
            {agent.supportedTrust.map(t => (
              <span key={t} className="font-mono text-[8px] px-1.5 py-0.5 bg-neon-cyan/10 text-neon-cyan/70 border border-neon-cyan/10">
                {t}
              </span>
            ))}
          </div>
          <span className={`font-mono text-[8px] ${agent.active ? "text-neon-green" : "text-neon-magenta"}`}>
            {agent.active ? "● ACTIVE" : "○ INACTIVE"}
          </span>
        </div>
      </div>
    </div>
  );
}

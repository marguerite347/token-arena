/**
 * AgentCustomizer — Personality weight sliders for AI agent builds
 * 
 * Players can tweak aggression, caution, greed, and creativity weights
 * to create unique agent builds that affect combat behavior and economic strategy.
 */
import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";

export interface PersonalityWeights {
  aggression: number;  // 0-100: How aggressively the agent engages
  caution: number;     // 0-100: How carefully the agent plays (retreat, evasion)
  greed: number;       // 0-100: How much the agent prioritizes token accumulation
  creativity: number;  // 0-100: How unpredictable/varied the agent's tactics are
}

export interface AgentBuild {
  id: string;
  name: string;
  weights: PersonalityWeights;
  description: string;
  icon: string;
}

// ─── Preset Builds ──────────────────────────────────────────────────────────
export const PRESET_BUILDS: AgentBuild[] = [
  {
    id: "berserker",
    name: "BERSERKER",
    weights: { aggression: 95, caution: 10, greed: 30, creativity: 20 },
    description: "All-out attack. Charges in, fires constantly, retreats only when nearly dead.",
    icon: "🔥",
  },
  {
    id: "sniper",
    name: "SNIPER",
    weights: { aggression: 40, caution: 70, greed: 50, creativity: 30 },
    description: "Maintains distance, picks off weakened targets with precision shots.",
    icon: "🎯",
  },
  {
    id: "economist",
    name: "ECONOMIST",
    weights: { aggression: 25, caution: 60, greed: 95, creativity: 40 },
    description: "Maximizes token efficiency. Uses cheap weapons, avoids costly fights.",
    icon: "💰",
  },
  {
    id: "chaos",
    name: "CHAOS AGENT",
    weights: { aggression: 60, caution: 30, greed: 40, creativity: 95 },
    description: "Unpredictable movement, random weapon switching, erratic targeting.",
    icon: "🌀",
  },
  {
    id: "tactician",
    name: "TACTICIAN",
    weights: { aggression: 55, caution: 55, greed: 55, creativity: 55 },
    description: "Balanced approach. Adapts to the situation with measured responses.",
    icon: "🧠",
  },
  {
    id: "assassin",
    name: "ASSASSIN",
    weights: { aggression: 80, caution: 50, greed: 70, creativity: 60 },
    description: "Targets the weakest opponent, finishes kills quickly, then repositions.",
    icon: "🗡️",
  },
];

// ─── Weight to Behavior Mapping ─────────────────────────────────────────────
export function weightsToTraits(weights: PersonalityWeights) {
  const { aggression, caution, greed, creativity } = weights;

  return {
    engageRange: 8 + (caution / 100) * 10,
    retreatHealthPct: 0.05 + (caution / 100) * 0.4,
    aggression: 0.02 + (aggression / 100) * 0.12,
    evasiveness: 0.1 + (caution / 100) * 0.7,
    targetPriority: greed > 70 ? "richest" as const : aggression > 70 ? "nearest" as const : caution > 60 ? "weakest" as const : "strongest" as const,
    preferredRange: caution > 60 ? "far" as const : aggression > 60 ? "close" as const : "mid" as const,
    strafeFrequency: 0.2 + (creativity / 100) * 0.6,
    weaponSwitchFrequency: 0.1 + (creativity / 100) * 0.5,
  };
}

// ─── Behavior Preview ───────────────────────────────────────────────────────
function getBehaviorSummary(weights: PersonalityWeights): string[] {
  const behaviors: string[] = [];
  const { aggression, caution, greed, creativity } = weights;

  if (aggression > 75) behaviors.push("Charges into combat aggressively");
  else if (aggression > 50) behaviors.push("Engages targets at moderate range");
  else behaviors.push("Avoids direct confrontation");

  if (caution > 75) behaviors.push("Retreats early when damaged");
  else if (caution < 25) behaviors.push("Fights to the last HP");

  if (greed > 75) behaviors.push("Prioritizes high-value targets");
  else if (greed < 25) behaviors.push("Ignores token economy");

  if (creativity > 75) behaviors.push("Unpredictable weapon switching");
  else if (creativity < 25) behaviors.push("Sticks to one weapon");

  const traits = weightsToTraits(weights);
  behaviors.push(`Preferred range: ${traits.preferredRange}`);
  behaviors.push(`Target priority: ${traits.targetPriority}`);

  return behaviors;
}

// ─── Radar Chart ────────────────────────────────────────────────────────────
function RadarChart({ weights }: { weights: PersonalityWeights }) {
  const labels = ["AGG", "CAU", "GRD", "CRE"];
  const values = [weights.aggression, weights.caution, weights.greed, weights.creativity];
  const cx = 60, cy = 60, r = 45;

  const points = values.map((v, i) => {
    const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
    const dist = (v / 100) * r;
    return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full">
      {/* Grid */}
      {gridLevels.map(level => {
        const gridPoints = [0, 1, 2, 3].map(i => {
          const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
          return { x: cx + Math.cos(angle) * r * level, y: cy + Math.sin(angle) * r * level };
        });
        const d = gridPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
        return <path key={level} d={d} fill="none" stroke="#1a2a3a" strokeWidth="0.5" />;
      })}

      {/* Axes */}
      {[0, 1, 2, 3].map(i => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * r}
            y2={cy + Math.sin(angle) * r}
            stroke="#1a2a3a"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Data polygon */}
      <path d={pathD} fill="rgba(0, 240, 255, 0.15)" stroke="#00f0ff" strokeWidth="1.5" />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#00f0ff" />
      ))}

      {/* Labels */}
      {labels.map((label, i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const lx = cx + Math.cos(angle) * (r + 10);
        const ly = cy + Math.sin(angle) * (r + 10);
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#4a6a8a"
            fontSize="6"
            fontFamily="monospace"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Slider Component ───────────────────────────────────────────────────────
function WeightSlider({
  label,
  value,
  onChange,
  color,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-gray-400">{label}</span>
        <span className="text-xs font-mono" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} ${value}%, #1a1a2e ${value}%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 font-mono">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
interface AgentCustomizerProps {
  onApply: (weights: PersonalityWeights, buildName: string) => void;
  onClose: () => void;
  initialWeights?: PersonalityWeights;
}

export default function AgentCustomizer({ onApply, onClose, initialWeights }: AgentCustomizerProps) {
  const [weights, setWeights] = useState<PersonalityWeights>(
    initialWeights || { aggression: 50, caution: 50, greed: 50, creativity: 50 }
  );
  const [buildName, setBuildName] = useState("CUSTOM BUILD");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const behaviors = useMemo(() => getBehaviorSummary(weights), [weights]);

  const updateWeight = useCallback((key: keyof PersonalityWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
    setSelectedPreset(null);
  }, []);

  const applyPreset = useCallback((build: AgentBuild) => {
    setWeights({ ...build.weights });
    setBuildName(build.name);
    setSelectedPreset(build.id);
  }, []);

  // Calculate overall "power rating"
  const powerRating = useMemo(() => {
    const avg = (weights.aggression + weights.caution + weights.greed + weights.creativity) / 4;
    const variance = Math.sqrt(
      ((weights.aggression - avg) ** 2 + (weights.caution - avg) ** 2 +
       (weights.greed - avg) ** 2 + (weights.creativity - avg) ** 2) / 4
    );
    // Specialized builds (high variance) get bonus
    return Math.round(avg + variance * 0.3);
  }, [weights]);

  return (
    <div className="bg-black/90 border border-cyan-500/20 rounded-xl overflow-hidden max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border-b border-cyan-500/20">
        <div>
          <h2 className="text-sm font-mono text-cyan-400 tracking-wider">AGENT CUSTOMIZATION</h2>
          <p className="text-[10px] text-gray-500 mt-0.5">Configure AI personality weights</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-sm"
        >
          ✕
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Sliders */}
        <div className="space-y-4">
          {/* Build name */}
          <div>
            <input
              type="text"
              value={buildName}
              onChange={(e) => setBuildName(e.target.value.toUpperCase())}
              className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-sm font-mono text-cyan-400 focus:border-cyan-500/50 focus:outline-none"
              maxLength={24}
            />
          </div>

          {/* Sliders */}
          <WeightSlider
            label="AGGRESSION"
            value={weights.aggression}
            onChange={(v) => updateWeight("aggression", v)}
            color="#FF3333"
            lowLabel="Passive"
            highLabel="Berserker"
          />
          <WeightSlider
            label="CAUTION"
            value={weights.caution}
            onChange={(v) => updateWeight("caution", v)}
            color="#39FF14"
            lowLabel="Reckless"
            highLabel="Defensive"
          />
          <WeightSlider
            label="GREED"
            value={weights.greed}
            onChange={(v) => updateWeight("greed", v)}
            color="#FFB800"
            lowLabel="Wasteful"
            highLabel="Hoarding"
          />
          <WeightSlider
            label="CREATIVITY"
            value={weights.creativity}
            onChange={(v) => updateWeight("creativity", v)}
            color="#AA00FF"
            lowLabel="Predictable"
            highLabel="Chaotic"
          />

          {/* Power rating */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <span className="text-xs font-mono text-gray-500">POWER RATING</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-pink-500"
                  style={{ width: `${powerRating}%` }}
                />
              </div>
              <span className="text-xs font-mono text-cyan-400">{powerRating}</span>
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          {/* Radar chart */}
          <div className="w-32 h-32 mx-auto">
            <RadarChart weights={weights} />
          </div>

          {/* Behavior preview */}
          <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
            <div className="text-[10px] font-mono text-gray-500 mb-2">PREDICTED BEHAVIOR</div>
            <div className="space-y-1">
              {behaviors.map((b, i) => (
                <div key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                  <span className="text-cyan-500 mt-0.5">▸</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div>
            <div className="text-[10px] font-mono text-gray-500 mb-2">PRESET TEMPLATES</div>
            <div className="grid grid-cols-3 gap-1">
              {PRESET_BUILDS.map((build) => (
                <button
                  key={build.id}
                  onClick={() => applyPreset(build)}
                  className={`text-center p-1.5 rounded border transition-all text-[10px] font-mono ${
                    selectedPreset === build.id
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-400"
                      : "border-gray-800 text-gray-500 hover:border-gray-700 hover:text-gray-400"
                  }`}
                >
                  <div className="text-sm">{build.icon}</div>
                  <div className="mt-0.5">{build.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-t border-gray-800">
        <button
          onClick={() => {
            setWeights({ aggression: 50, caution: 50, greed: 50, creativity: 50 });
            setSelectedPreset(null);
            setBuildName("CUSTOM BUILD");
          }}
          className="text-xs font-mono text-gray-500 hover:text-gray-300 px-3 py-1 border border-gray-700 rounded"
        >
          RESET
        </button>
        <button
          onClick={() => onApply(weights, buildName)}
          className="text-xs font-mono text-cyan-400 px-4 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded hover:bg-cyan-500/30 transition-colors"
        >
          APPLY BUILD →
        </button>
      </div>
    </div>
  );
}

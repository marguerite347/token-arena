/**
 * GameMasterPanel — AI Dungeon Master Dashboard
 * Shows the Master Game Design Agent's analysis and actions
 */
import { trpc } from "@/lib/trpc";

interface GameMasterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GameMasterPanel({ isOpen, onClose }: GameMasterPanelProps) {
  const { data: snapshot } = trpc.gameMaster.latestSnapshot.useQuery(undefined, { enabled: isOpen });
  const { data: history } = trpc.gameMaster.history.useQuery(undefined, { enabled: isOpen });

  const analyzeMutation = trpc.gameMaster.analyze.useMutation();

  if (!isOpen) return null;

  const healthColor = (h: number) => h > 0.7 ? "#39FF14" : h > 0.4 ? "#FFB800" : "#FF3366";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-lg overflow-hidden"
        style={{ background: "rgba(10,10,15,0.98)", border: "1px solid #FFB80033" }}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-yellow-900/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎲</span>
            <div>
              <h2 className="font-orbitron text-yellow-400 text-sm tracking-wider">MASTER GAME DESIGN AGENT</h2>
              <p className="text-xs text-gray-500 font-mono">AI Dungeon Master — Economy Rebalancer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">&times;</button>
        </div>

        {/* Trigger Analysis */}
        <div className="p-4 border-b border-gray-800">
          <button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            className="w-full py-3 text-sm font-mono uppercase tracking-wider rounded transition-all"
            style={{
              background: analyzeMutation.isPending ? "rgba(255,184,0,0.1)" : "rgba(255,184,0,0.2)",
              color: "#FFB800", border: "1px solid #FFB80044",
            }}>
            {analyzeMutation.isPending ? "🎲 ANALYZING META..." : "🎲 RUN META ANALYSIS"}
          </button>

          {/* Live Result */}
          {analyzeMutation.data && (
            <div className="mt-3 p-3 rounded space-y-2"
              style={{ background: "rgba(255,184,0,0.05)", border: "1px solid #FFB80022" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-yellow-400 uppercase">Live Analysis</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500">Economy Health:</span>
                  <span className="text-sm font-mono font-bold"
                    style={{ color: healthColor(analyzeMutation.data.economyHealth) }}>
                    {(analyzeMutation.data.economyHealth * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-300 font-mono">{analyzeMutation.data.analysis}</p>
              <div className="text-xs text-gray-500 font-mono">
                Dominant Strategy: <span className="text-cyan-400">{analyzeMutation.data.dominantStrategy}</span>
              </div>

              {/* Actions */}
              {analyzeMutation.data.actions.length > 0 && (
                <div className="space-y-1 mt-2">
                  <span className="text-xs font-mono text-gray-500">Actions Taken:</span>
                  {analyzeMutation.data.actions.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono p-1 rounded"
                      style={{ background: "rgba(255,255,255,0.03)" }}>
                      <span className={`px-1 rounded ${
                        a.type === "buff" ? "text-green-400 bg-green-950/30" :
                        a.type === "nerf" ? "text-red-400 bg-red-950/30" :
                        a.type === "new_item" ? "text-yellow-400 bg-yellow-950/30" :
                        a.type === "new_recipe" ? "text-purple-400 bg-purple-950/30" :
                        "text-cyan-400 bg-cyan-950/30"
                      }`}>{a.type.toUpperCase()}</span>
                      <span className="text-white">{a.target}</span>
                      <span className="text-gray-500">— {a.details}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* New Recipe */}
              {analyzeMutation.data.newRecipe && (
                <div className="p-2 rounded mt-2"
                  style={{ background: "rgba(255,184,0,0.1)", border: "1px solid #FFB80033" }}>
                  <div className="text-xs font-mono text-yellow-400">✨ NEW RECIPE INTRODUCED</div>
                  <div className="text-sm font-mono text-white mt-1">{analyzeMutation.data.newRecipe.name}</div>
                  <div className="text-xs text-gray-400">{analyzeMutation.data.newRecipe.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Type: {analyzeMutation.data.newRecipe.resultType} | Cost: {analyzeMutation.data.newRecipe.craftingCost} ARENA
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Analysis History</span>

          {snapshot && (
            <div className="p-3 rounded space-y-1"
              style={{ background: "rgba(255,255,255,0.03)", borderLeft: "3px solid #FFB800" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-yellow-400">Latest Snapshot</span>
                <span className="text-xs font-mono"
                  style={{ color: healthColor(snapshot.economyHealth ?? 0.5) }}>
                  Health: {((snapshot.economyHealth ?? 0.5) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-gray-300 font-mono">{snapshot.analysis}</p>
              <div className="text-xs text-gray-500 font-mono">
                Dominant: {snapshot.dominantStrategy} | Matches Analyzed: {snapshot.matchesAnalyzed}
              </div>
            </div>
          )}

          {history?.slice(1).map((snap: any) => (
            <div key={snap.id} className="p-2 rounded text-xs font-mono"
              style={{ background: "rgba(255,255,255,0.02)", borderLeft: "3px solid #888" }}>
              <div className="flex justify-between text-gray-500">
                <span>Health: {((snap.economyHealth ?? 0.5) * 100).toFixed(0)}%</span>
                <span>{snap.matchesAnalyzed} matches</span>
              </div>
              <p className="text-gray-400 mt-1">{snap.analysis}</p>
            </div>
          ))}

          {(!history || history.length === 0) && !snapshot && (
            <p className="text-gray-600 text-xs font-mono text-center py-4">
              No analysis yet. Click "Run Meta Analysis" above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

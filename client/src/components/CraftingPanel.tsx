/**
 * CraftingPanel — In-game crafting interface
 * Shows materials collected, available recipes, and crafted items
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";

interface CraftingPanelProps {
  agentId: number;
  isOpen: boolean;
  onClose: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: "#8899AA",
  uncommon: "#39FF14",
  rare: "#00F0FF",
  epic: "#9D00FF",
  legendary: "#FFB800",
};

export default function CraftingPanel({ agentId, isOpen, onClose }: CraftingPanelProps) {
  const [tab, setTab] = useState<"materials" | "recipes" | "crafted" | "discover">("materials");
  const [craftingStatus, setCraftingStatus] = useState<string>("");

  const { data: materials } = trpc.crafting.materials.useQuery(undefined, { enabled: isOpen });
  const { data: recipes } = trpc.crafting.recipes.useQuery(undefined, { enabled: isOpen });
  const { data: inventory } = trpc.agent.inventory.useQuery({ agentId }, { enabled: isOpen });
  const { data: recentItems } = trpc.crafting.recentItems.useQuery(undefined, { enabled: isOpen && tab === "crafted" });
  const { data: emergentRecipes } = trpc.crafting.emergentRecipes.useQuery(undefined, { enabled: isOpen && tab === "discover" });

  const craftMutation = trpc.crafting.craft.useMutation({
    onSuccess: (data) => {
      if (data.error) {
        setCraftingStatus(`Failed: ${data.error}`);
      } else {
        setCraftingStatus(`Crafted ${data.itemName}!`);
        setTimeout(() => setCraftingStatus(""), 3000);
      }
    },
  });

  const discoverMutation = trpc.crafting.discover.useMutation({
    onSuccess: (data) => {
      if (data.success && data.recipe) {
        setCraftingStatus(`Discovered: ${data.recipe.name}!`);
      } else {
        setCraftingStatus("Discovery failed — try again");
      }
      setTimeout(() => setCraftingStatus(""), 4000);
    },
  });

  if (!isOpen) return null;

  const getInventoryCount = (materialId: number) => {
    if (!inventory) return 0;
    const item = inventory.find((i: any) => i.itemType === "material" && i.itemId === materialId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.95)", borderLeft: "1px solid #00F0FF33" }}>

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-cyan-900/50">
        <span className="font-orbitron text-cyan-400 text-sm tracking-wider">CRAFTING LAB</span>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">&times;</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(["materials", "recipes", "crafted", "discover"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider transition-colors ${tab === t ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-950/20" : "text-gray-600 hover:text-gray-400"}`}>
            {t === "discover" ? "🔬" : ""}{t}
          </button>
        ))}
      </div>

      {/* Status */}
      {craftingStatus && (
        <div className="px-3 py-2 text-xs font-mono text-center"
          style={{ background: "rgba(0,240,255,0.1)", color: "#00F0FF" }}>
          {craftingStatus}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tab === "materials" && (
          <>
            <p className="text-gray-500 text-xs font-mono mb-2">Materials drop from kills. Weapon affinity increases drop rates.</p>
            {materials?.map((mat: any) => (
              <div key={mat.id} className="flex items-center gap-2 p-2 rounded"
                style={{ background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${mat.color || "#888"}` }}>
                <div className="w-6 h-6 rounded" style={{ background: mat.color || "#888", opacity: 0.8 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-white truncate">{mat.name}</div>
                  <div className="text-xs" style={{ color: RARITY_COLORS[mat.rarity] || "#888" }}>{mat.rarity}</div>
                </div>
                <div className="text-xs font-mono text-cyan-400">x{getInventoryCount(mat.id)}</div>
              </div>
            ))}
            {(!materials || materials.length === 0) && (
              <p className="text-gray-600 text-xs font-mono text-center py-4">No materials seeded yet. Start a match!</p>
            )}
          </>
        )}

        {tab === "recipes" && (
          <>
            <p className="text-gray-500 text-xs font-mono mb-2">Combine materials to craft unique items.</p>
            {recipes?.map((recipe: any) => (
              <div key={recipe.id} className="p-2 rounded space-y-1"
                style={{ background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${recipe.isEmergent ? "#FFB800" : "#39FF14"}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white">{recipe.name}</span>
                  {recipe.isEmergent === 1 && <span className="text-xs text-yellow-400">✨ EMERGENT</span>}
                </div>
                <p className="text-xs text-gray-500">{recipe.description}</p>
                <div className="text-xs text-gray-600 font-mono">
                  Type: <span className="text-cyan-400">{recipe.resultType}</span> | Cost: <span className="text-yellow-400">{recipe.craftingCost} ARENA</span>
                </div>
                <button onClick={() => craftMutation.mutate({ recipeId: recipe.id, agentId })}
                  disabled={craftMutation.isPending}
                  className="w-full mt-1 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors"
                  style={{ background: "rgba(0,240,255,0.15)", color: "#00F0FF", border: "1px solid #00F0FF33" }}>
                  {craftMutation.isPending ? "CRAFTING..." : "CRAFT"}
                </button>
              </div>
            ))}
          </>
        )}

        {tab === "crafted" && (
          <>
            <p className="text-gray-500 text-xs font-mono mb-2">Recently crafted items across all agents.</p>
            {recentItems?.map((item: any) => (
              <div key={item.id} className="p-2 rounded"
                style={{ background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${RARITY_COLORS[item.rarity] || "#888"}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-white">{item.itemName}</span>
                  <span className="text-xs" style={{ color: RARITY_COLORS[item.rarity] || "#888" }}>{item.rarity}</span>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  Type: {item.itemType} | By Agent #{item.craftedBy} | Owner: #{item.ownedBy}
                </div>
              </div>
            ))}
            {(!recentItems || recentItems.length === 0) && (
              <p className="text-gray-600 text-xs font-mono text-center py-4">No items crafted yet.</p>
            )}
          </>
        )}

        {tab === "discover" && (
          <>
            <p className="text-gray-500 text-xs font-mono mb-2">Use LLM to discover entirely new recipes. Costs creativity, not tokens.</p>
            <button onClick={() => discoverMutation.mutate({ agentId, agentName: `Agent #${agentId}` })}
              disabled={discoverMutation.isPending}
              className="w-full py-3 text-sm font-mono uppercase tracking-wider rounded transition-all"
              style={{
                background: discoverMutation.isPending ? "rgba(255,184,0,0.1)" : "rgba(255,184,0,0.2)",
                color: "#FFB800", border: "1px solid #FFB80044",
              }}>
              {discoverMutation.isPending ? "🔬 DISCOVERING..." : "🔬 DISCOVER NEW RECIPE"}
            </button>

            <div className="mt-3">
              <span className="text-xs font-mono text-gray-500">Emergent Recipes:</span>
            </div>
            {emergentRecipes?.map((recipe: any) => (
              <div key={recipe.id} className="p-2 rounded"
                style={{ background: "rgba(255,184,0,0.05)", borderLeft: "3px solid #FFB800" }}>
                <div className="text-xs font-mono text-yellow-400">{recipe.name} ✨</div>
                <p className="text-xs text-gray-500">{recipe.description}</p>
                <div className="text-xs text-gray-600 font-mono">
                  Discovered by Agent #{recipe.discoveredBy} | {recipe.resultType} | {recipe.craftingCost} ARENA
                </div>
              </div>
            ))}
            {(!emergentRecipes || emergentRecipes.length === 0) && (
              <p className="text-gray-600 text-xs font-mono text-center py-2">No emergent recipes discovered yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

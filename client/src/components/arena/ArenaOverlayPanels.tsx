/**
 * ArenaOverlayPanels — All overlay panel modals (Crafting, Brain, GameMaster, DAO, Prediction, Replay, Customizer)
 */
import { AnimatePresence, motion } from "framer-motion";
import CraftingPanel from "@/components/CraftingPanel";
import AgentBrainPanel from "@/components/AgentBrainPanel";
import GameMasterPanel from "@/components/GameMasterPanel";
import DAOPanel from "@/components/DAOPanel";
import PredictionPanel from "@/components/PredictionPanel";
import ReplayViewer from "@/components/ReplayViewer";
import ReplayList from "@/components/ReplayList";
import AgentCustomizer, { type PersonalityWeights } from "@/components/AgentCustomizer";
import type { ReplayData } from "@/lib/replayEngine";

interface PanelState {
  crafting: boolean;
  brain: boolean;
  gameMaster: boolean;
  dao: boolean;
  prediction: boolean;
  replayViewer: boolean;
  replayList: boolean;
  customizer: boolean;
}

interface ArenaOverlayPanelsProps {
  panels: PanelState;
  activeReplay: ReplayData | null;
  agentWeights: PersonalityWeights | null;
  onClosePanel: (panel: keyof PanelState) => void;
  onSelectReplay: (replay: ReplayData) => void;
  onApplyCustomizer: (weights: PersonalityWeights, name: string) => void;
}

export default function ArenaOverlayPanels({
  panels,
  activeReplay,
  agentWeights,
  onClosePanel,
  onSelectReplay,
  onApplyCustomizer,
}: ArenaOverlayPanelsProps) {
  return (
    <>
      {/* Crafting Panel */}
      <CraftingPanel agentId={1} isOpen={panels.crafting} onClose={() => onClosePanel("crafting")} />

      {/* Agent Brain Panel */}
      <AgentBrainPanel isOpen={panels.brain} onClose={() => onClosePanel("brain")} />

      {/* Game Master Panel */}
      <GameMasterPanel isOpen={panels.gameMaster} onClose={() => onClosePanel("gameMaster")} />

      {/* DAO Governance Panel */}
      <DAOPanel isOpen={panels.dao} onClose={() => onClosePanel("dao")} />

      {/* Prediction Market Panel */}
      <PredictionPanel isOpen={panels.prediction} onClose={() => onClosePanel("prediction")} />

      {/* Replay Viewer */}
      {panels.replayViewer && activeReplay && (
        <ReplayViewer
          replay={activeReplay}
          onClose={() => onClosePanel("replayViewer")}
        />
      )}

      {/* Replay List */}
      <AnimatePresence>
        {panels.replayList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90"
          >
            <div className="max-w-lg w-full mx-4 bg-black/80 border border-cyan-500/20 rounded-xl p-6">
              <ReplayList
                onSelectReplay={(replay) => {
                  onSelectReplay(replay);
                }}
                onClose={() => onClosePanel("replayList")}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent Customizer */}
      <AnimatePresence>
        {panels.customizer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90"
          >
            <AgentCustomizer
              onApply={onApplyCustomizer}
              onClose={() => onClosePanel("customizer")}
              initialWeights={agentWeights || undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export type { PanelState };

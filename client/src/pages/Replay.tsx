/**
 * Replay Page — View a specific replay by ID
 * Accessed via /replay/:id from shareable links
 */
import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import ReplayViewer from "@/components/ReplayViewer";
import { getStoredReplays, type ReplayData } from "@/lib/replayEngine";

export default function ReplayPage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) {
      setError("No replay ID provided");
      return;
    }
    const allReplays = getStoredReplays();
    const found = allReplays.find(r => r.id === params.id) || null;
    if (found) {
      setReplay(found);
    } else {
      setError("Replay not found. It may have been deleted or is stored on another device.");
    }
  }, [params.id]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center space-y-6 max-w-md mx-auto px-4">
          <div className="text-6xl">🎬</div>
          <h1 className="text-2xl font-bold text-white font-[Orbitron]">Replay Not Found</h1>
          <p className="text-gray-400">{error}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate("/arena")}
              className="px-6 py-3 bg-[#00F0FF]/20 border border-[#00F0FF]/50 text-[#00F0FF] font-bold hover:bg-[#00F0FF]/30 transition-all"
            >
              GO TO ARENA
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-white/5 border border-white/20 text-white font-bold hover:bg-white/10 transition-all"
            >
              HOME
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!replay) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-[#00F0FF] animate-pulse text-xl font-[Orbitron]">
          LOADING REPLAY...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <div className="p-4">
        <button
          onClick={() => navigate("/arena")}
          className="text-[#00F0FF]/70 hover:text-[#00F0FF] transition-colors text-sm font-mono mb-4 flex items-center gap-2"
        >
          ← BACK TO ARENA
        </button>
      </div>
      <ReplayViewer
        replay={replay}
        onClose={() => navigate("/arena")}
      />
    </div>
  );
}

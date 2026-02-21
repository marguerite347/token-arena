import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SkyboxViewer } from "@/components/SkyboxViewer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";

export function SkyboxGallery() {
  const [selectedSkyboxId, setSelectedSkyboxId] = useState<number | null>(null);

  // Fetch all cached skyboxes
  const { data: skyboxes, isLoading } = trpc.skybox.getAllCached.useQuery() as any;

  // Fetch skybox styles for reference
  const { data: styles } = trpc.skybox.getStyles.useQuery();

  const selectedSkybox = skyboxes?.find((s: any) => s.id === selectedSkyboxId) || skyboxes?.[0];

  const getStyleName = (styleId: number) => {
    return (styles as any)?.find((s: any) => s.id === styleId)?.name || `Style ${styleId}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              Blockade Labs Skybox Gallery
            </h1>
          </div>
          <p className="text-slate-400 max-w-2xl">
            Explore AI-generated 360° panoramic environments using Blockade Labs Skybox Model 4. Each arena is a unique, immersive setting for Token Arena battles.
          </p>
        </div>

        {/* Main Viewer */}
        {isLoading ? (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </CardContent>
          </Card>
        ) : selectedSkybox && selectedSkybox.fileUrl ? (
          <SkyboxViewer
            imageUrl={selectedSkybox.fileUrl}
            title={getStyleName(selectedSkybox.styleId)}
            description={selectedSkybox.prompt}
          />
        ) : (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-slate-400">No skyboxes available. Generate one in the Arena!</p>
            </CardContent>
          </Card>
        )}

        {/* Gallery Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Generated Panoramas</h2>
          {skyboxes && skyboxes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {skyboxes.map((skybox: any) => (
                <Card
                  key={skybox.id}
                  className={`bg-slate-800/50 border transition-all cursor-pointer ${
                    selectedSkyboxId === skybox.id
                      ? "border-cyan-400 ring-2 ring-cyan-400/50"
                      : "border-slate-700/50 hover:border-slate-600"
                  }`}
                  onClick={() => setSelectedSkyboxId(skybox.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{getStyleName(skybox.styleId)}</CardTitle>
                    <CardDescription className="text-xs">
                      {skybox.status === "completed" ? "✓ Ready" : "⏳ Generating..."}
                    </CardDescription>
                  </CardHeader>
                  {skybox.thumbUrl && (
                    <CardContent className="p-0">
                      <div className="relative h-32 bg-slate-900 overflow-hidden rounded-b">
                        <img
                          src={skybox.thumbUrl}
                          alt={getStyleName(skybox.styleId)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </CardContent>
                  )}
                  <CardContent className="pt-3 space-y-2">
                    <p className="text-xs text-slate-400 line-clamp-2">{skybox.prompt}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs border-slate-600 hover:bg-slate-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSkyboxId(skybox.id);
                      }}
                    >
                      View 360°
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-slate-400">No skyboxes generated yet</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info Section */}
        <Card className="bg-gradient-to-r from-purple-900/20 to-cyan-900/20 border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-lg">About These Panoramas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>
              🎨 <strong>Blockade Labs Skybox AI Model 4</strong> — Advanced AI model generating photorealistic 360° panoramic environments
            </p>
            <p>
              🎮 <strong>Used in Token Arena</strong> — Each battle takes place in a unique, AI-generated arena environment
            </p>
            <p>
              🔄 <strong>Interactive Viewer</strong> — Drag to rotate, scroll to zoom. Experience the full immersion of each arena
            </p>
            <p>
              ⛓️ <strong>On-Chain Integration</strong> — Arena metadata stored on Base mainnet; skybox generation costs paid from agent token budgets
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

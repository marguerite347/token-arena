/*
 * Home Page — Spectator-first landing for Token Arena
 * Minimal: Logo + WATCH CTA + subtle menu for secondary pages
 * The entire experience funnels into Watch Mode
 */
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Eye, Play, Menu, X, Zap, Swords, Coins, Brain, Trophy, ChevronRight } from "lucide-react";

// M4 Skybox: Digital Void Chamber — cyan/magenta neon grid, Tron-like aesthetic
const HERO_IMG = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663362740070/ZKYjtULxRbKctHFh.jpg";

export default function Home() {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const secondaryPages = [
    { label: "Arena", path: "/arena", icon: Swords },
    { label: "Armory", path: "/shop", icon: Zap },
    { label: "Rankings", path: "/leaderboard", icon: Trophy },
    { label: "Flywheel", path: "/flywheel", icon: Coins },
    { label: "Factions", path: "/factions", icon: Brain },
    { label: "Betting", path: "/betting", icon: Coins },
    { label: "Replays", path: "/replays", icon: Play },
    { label: "Swap", path: "/swap", icon: Zap },
    { label: "Agents", path: "/agent-demo", icon: Brain },
    { label: "Skybox Gallery", path: "/skybox-gallery", icon: Eye },
    { label: "DAO", path: "/dao-domains", icon: Trophy },
    { label: "Auctions", path: "/auctions", icon: Coins },
    { label: "Dashboard", path: "/dashboard", icon: Brain },
    { label: "Docs", path: "/demo", icon: Zap },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Full-bleed hero background */}
      <div className="fixed inset-0">
        <img src={HERO_IMG} alt="" className="w-full h-full object-cover opacity-40" style={{ objectPosition: "center 40%", animation: "skyboxFloat 120s ease-in-out infinite" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
      </div>

      {/* Scanline overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1]"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.01) 2px, rgba(0,255,255,0.01) 4px)" }}
      />

      {/* Minimal top bar — just logo + menu icon */}
      <div className="relative z-20 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-cyan-400 animate-pulse" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
          <span className="font-['Orbitron'] text-xs font-bold text-cyan-400/80 tracking-[0.3em]">TOKEN ARENA</span>
        </div>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg text-white/30 hover:text-white/60 transition-colors"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Slide-out menu for secondary pages */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/60"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-72 z-40 overflow-y-auto"
              style={{ background: "rgba(10,10,26,0.95)", borderLeft: "1px solid rgba(0,255,255,0.08)" }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <span className="font-['Orbitron'] text-[10px] tracking-[0.3em] text-white/30">NAVIGATE</span>
                  <button onClick={() => setMenuOpen(false)} className="text-white/30 hover:text-white/60">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  {secondaryPages.map(p => (
                    <button
                      key={p.path}
                      onClick={() => { navigate(p.path); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.03] transition-all group"
                    >
                      <p.icon className="w-4 h-4 text-white/20 group-hover:text-cyan-400/60 transition-colors" />
                      <span className="text-sm font-mono">{p.label}</span>
                      <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-40 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content — centered hero with single CTA */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* ETHDenver badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-cyan-500/20 bg-cyan-500/5">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-mono text-green-400/80 tracking-wider">LIVE · ETHDenver 2026</span>
          </div>

          {/* Title */}
          <h1 className="font-['Orbitron'] text-5xl md:text-8xl font-black tracking-wider leading-[0.9] mb-6">
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-200 bg-clip-text text-transparent">TOKEN</span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">ARENA</span>
          </h1>

          {/* Tagline */}
          <p className="text-white/50 text-lg md:text-xl max-w-xl mx-auto mb-3 leading-relaxed">
            AI agents battle in 360° arenas. Every bullet is a token.
            <br className="hidden md:block" />
            Every hit is a transfer. You just watch.
          </p>
          <p className="font-mono text-[11px] text-white/20 mb-10">
            On-chain token economy · Base L2 · Skybox AI Model 4 · Multi-LLM agents
          </p>

          {/* Single CTA — WATCH */}
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 0 40px rgba(0,255,255,0.15)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/watch")}
            className="group relative px-16 py-5 rounded-2xl font-['Orbitron'] text-base font-bold tracking-[0.2em] bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 hover:from-cyan-500 hover:via-purple-500 hover:to-pink-500 shadow-xl shadow-purple-500/20 transition-all"
          >
            <Eye className="w-5 h-5 inline mr-3 -mt-0.5" />
            WATCH LIVE
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/10 to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>

          {/* Subtle stats */}
          <div className="flex items-center justify-center gap-8 mt-12 text-white/15">
            <div className="text-center">
              <p className="font-mono text-lg font-bold text-white/25">6</p>
              <p className="text-[9px] font-mono">AI AGENTS</p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="text-center">
              <p className="font-mono text-lg font-bold text-white/25">4</p>
              <p className="text-[9px] font-mono">LLM MODELS</p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="text-center">
              <p className="font-mono text-lg font-bold text-white/25">360°</p>
              <p className="text-[9px] font-mono">SKYBOX ARENAS</p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="text-center">
              <p className="font-mono text-lg font-bold text-white/25">BASE</p>
              <p className="text-[9px] font-mono">ON-CHAIN</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-6 left-0 right-0 z-10 text-center">
        <motion.p
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-[10px] font-mono text-white/20"
        >
          Spectators watch · Agents fight · Tokens flow
        </motion.p>
      </div>
    </div>
  );
}

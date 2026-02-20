/*
 * Home Page — Landing / Lobby screen for Token Arena
 * Design: Neon Brutalism — dramatic hero with generated images, angular layouts, neon accents
 * Typography: Orbitron display, JetBrains Mono data, Space Grotesk body
 */
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGame } from "@/contexts/GameContext";

const HERO_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/7BCFtZ5fWXyj3HdnF9KQB1/sandbox/50QAFITnEfFX4BKquAhRbU-img-1_1771544637000_na1fn_aGVyby1hcmVuYQ.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN0JDRnRaNWZXWHlqM0hkbkY5S1FCMS9zYW5kYm94LzUwUUFGSVRuRWZGWDRCS3F1QWhSYlUtaW1nLTFfMTc3MTU0NDYzNzAwMF9uYTFmbl9hR1Z5YnkxaGNtVnVZUS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=TJ~WUcbAsraZKdAfdrmFDS2528Dwq5OuGQh6CY7cbGSjX7hEq0gt0w1D-xZt5dnwQnZGAN0NRpLd2AGj8QQue7iavJ~jcOiwuI4T2QaF28QfPAMUe3REYvEJ87a9Wehng~hbxIVaYMxk2i6UnSy2kbVhAqCkrMLnqoT0p7UYtAxta46Y-zUhdP3~4MSThcq1pzkP7SOtWzcQQBXD9CD3k9PYdF3nEbKvbc8A7Q0ZAVkSOAEEXszP6kbj9sKXh8zRLJBdXT6~4QNBcCvGIqqN-3wl0gX072AJq73H3qEa8crwa7Blw2fsWHd8a1Mmm8z~f-WBHEXYKij8OYSnBgc4LA__";

const AI_BATTLE_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/7BCFtZ5fWXyj3HdnF9KQB1/sandbox/50QAFITnEfFX4BKquAhRbU-img-3_1771544644000_na1fn_YWktYWdlbnQtYmF0dGxl.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN0JDRnRaNWZXWHlqM0hkbkY5S1FCMS9zYW5kYm94LzUwUUFGSVRuRWZGWDRCS3F1QWhSYlUtaW1nLTNfMTc3MTU0NDY0NDAwMF9uYTFmbl9ZV2t0WVdkbGJuUXRZbUYwZEd4bC5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=vuQfJpUvOVR3beFfj5e7uLqDoDLjUo4bAUA4WiVAeEU4lkUiA-zle~0sAaW62VCvQqtEhQABrmtr8uNflO~OAKfEH8L5xNN4fqGTtOPKqgSp8ocVRkA8eVooLSxwE-qPiVl9if8-58KF7bK7wFGxqsMJSPY2wWH6qbNkiXm~2CAm64kLPccn-X4EEcbaY-XfFuo6qVBI6Rg1CovhU0b9kL3saVjwueHd2EUAR0LG1xh1sOUiIlFqjzPH8swd78XO7FaZq1~uQtZZikWus5z07FAtxvWE63QVQ5KQ0-jSJIdvfFb1~L~8eDiChLeX0Hsn53rG1IbnjSvSCHKmADb8jg__";

const TOKEN_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/7BCFtZ5fWXyj3HdnF9KQB1/sandbox/50QAFITnEfFX4BKquAhRbU-img-2_1771544649000_na1fn_dG9rZW4tZXhwbG9zaW9u.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN0JDRnRaNWZXWHlqM0hkbkY5S1FCMS9zYW5kYm94LzUwUUFGSVRuRWZGWDRCS3F1QWhSYlUtaW1nLTJfMTc3MTU0NDY0OTAwMF9uYTFmbl9kRzlyWlc0dFpYaHdiRzl6YVc5dS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=ZbGnKkdr~CWc5vhhcujb9dGJhqbRSfgVDkAvUgliUiA~1nXpFPGTW0g9sQuFaoCCWG4MoFSwuXghFrD3YsoPr7OhxTeU2JdGryIOBSFaPdw6THUZ5TZY~phP45I6VuPG4KDlKFGQk0CG7bHDcuGVPxwEI-uhFqoJwS8QoxuwJhdKUQHzjfBtzfrsSKScFaifcW2hiQhTN5ufx3ZMP-SxIO9kG2gVlH2Nbh5-s~QXQMhA-sErvDXPO63-jMQuUxpsNAriNliC4eKjG2JC-CES-UUV7YIIJ38K4HEKrn4UjGlHlFmMYuIIB9Qws2uqzFdEjnpittlcJJJP3Uu9v4EdrQ__";

const BG_PATTERN = "https://private-us-east-1.manuscdn.com/sessionFile/7BCFtZ5fWXyj3HdnF9KQB1/sandbox/50QAFITnEfFX4BKquAhRbU-img-5_1771544644000_na1fn_Z2FtZS1iZy1wYXR0ZXJu.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvN0JDRnRaNWZXWHlqM0hkbkY5S1FCMS9zYW5kYm94LzUwUUFGSVRuRWZGWDRCS3F1QWhSYlUtaW1nLTVfMTc3MTU0NDY0NDAwMF9uYTFmbl9aMkZ0WlMxaVp5MXdZWFIwWlhKdS5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=At1nxOu8UOcHtZvjEbuMFI09zJUiP3gLdBxT6wzyaQQkab4japFOspC4HO0urMcjPwtM1ytBNPFDyAauLrIo23EM8NX0iSUNTcfIYBDeF17CxRm2aZ4ki6aSxnJ-4qkI5Q1AfQDS2wXAfdihmKGqAKAWCbzhZVT1ymqwhpWdtndpB0TzAeAHHQ0Z28ZTmZPTKZXydNLOoCX9rlaG4uiPIi2I6YzSZMVdBBe56mTqLMzHg8FL6lKLgbNxddrME99Zez86uMwFqzlzVXI8n62KL3jtFrxjuGqEnnYtzFB5DBDoaV7dYjBXIRRg346Z15SmrclMfeJLccCZ~uOPEX0Lyw__";

export default function Home() {
  const [, navigate] = useLocation();
  const { state } = useGame();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: `url(${BG_PATTERN})` }} />
      <div className="fixed inset-0 bg-gradient-to-b from-background via-background/95 to-background" />

      {/* Scanline overlay */}
      <div className="fixed inset-0 scanline-overlay opacity-15 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">
        {/* Nav bar */}
        <nav className="flex items-center justify-between px-6 py-4 border-b border-border/20">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-neon-cyan animate-pulse-neon" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
            <span className="font-display text-sm font-bold text-neon-cyan tracking-[0.3em]">TOKEN ARENA</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => navigate("/arena")} className="text-xs font-mono text-muted-foreground hover:text-neon-cyan transition-colors">
              ARENA
            </button>
            <button onClick={() => navigate("/shop")} className="text-xs font-mono text-muted-foreground hover:text-neon-green transition-colors">
              ARMORY
            </button>
            <button onClick={() => navigate("/leaderboard")} className="text-xs font-mono text-muted-foreground hover:text-neon-amber transition-colors">
              RANKINGS
            </button>
            <div className="hud-panel clip-brutal-sm px-3 py-1">
              <span className="font-display text-sm text-neon-green text-glow-green">{state.player.tokens}</span>
              <span className="text-[9px] font-mono text-neon-green/60 ml-1">TKN</span>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative min-h-[85vh] flex items-center">
          {/* Hero background image */}
          <div className="absolute inset-0 overflow-hidden">
            <img
              src={HERO_IMG}
              alt="Token Arena"
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
          </div>

          <div className="relative z-10 container">
            <div className="max-w-2xl">
              <motion.div initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6 }}>
                {/* ETHDenver badge */}
                <div className="inline-flex items-center gap-2 hud-panel clip-brutal-sm px-3 py-1 mb-6">
                  <div className="w-1.5 h-1.5 bg-neon-green animate-pulse-neon" />
                  <span className="text-[10px] font-mono text-neon-green">ETHDenver 2026 HACKATHON</span>
                </div>

                <h1 className="font-display text-5xl md:text-7xl font-black tracking-wider leading-none mb-4">
                  <span className="text-neon-cyan text-glow-cyan">TOKEN</span>
                  <br />
                  <span className="text-neon-magenta text-glow-magenta">ARENA</span>
                </h1>

                <p className="font-sans text-lg text-foreground/80 mb-2 max-w-lg leading-relaxed">
                  AI agents battle in 360° environments generated by Skybox AI. Every bullet is a token. Every hit is a transfer. Survive and keep what you earn.
                </p>
                <p className="font-mono text-xs text-muted-foreground mb-8">
                  On-chain token economy on Base L2 · x402 payments · ERC-8004 agent identity
                </p>

                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => navigate("/arena")}
                    className="clip-brutal px-8 py-3 bg-neon-cyan text-background font-display text-sm font-bold tracking-wider hover:bg-neon-cyan/80 transition-colors neon-glow-cyan"
                  >
                    ENTER ARENA
                  </button>
                  <button
                    onClick={() => navigate("/shop")}
                    className="clip-brutal px-8 py-3 border border-neon-green/40 text-neon-green font-display text-sm font-bold tracking-wider hover:bg-neon-green/10 transition-colors"
                  >
                    ARMORY
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 relative">
          <div className="container">
            <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}>
              <div className="text-center mb-12">
                <div className="text-[10px] font-mono text-neon-cyan/70 uppercase tracking-[0.3em] mb-2">Game Mechanics</div>
                <h2 className="font-display text-3xl font-bold text-foreground tracking-wider">HOW IT WORKS</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    title: "SHOOT = SPEND",
                    desc: "Every shot costs tokens. Different weapons cost different amounts. Choose wisely — your ammo is your wallet.",
                    color: "#00F0FF",
                    stat: "2-15 TKN/shot",
                  },
                  {
                    title: "HIT = COLLECT",
                    desc: "Getting hit by enemy fire means collecting those tokens. Turn defense into profit. Tank builds earn more.",
                    color: "#FF00AA",
                    stat: "Token transfer on hit",
                  },
                  {
                    title: "SURVIVE = KEEP",
                    desc: "At match end, you keep all tokens in your balance. Spend them in the Armory for weapons, armor, and deployables.",
                    color: "#39FF14",
                    stat: "On-chain settlement",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 30, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="hud-panel clip-brutal p-6 group hover:border-white/20 transition-all"
                  >
                    <div className="font-display text-xl font-bold mb-3 group-hover:animate-glitch" style={{ color: item.color }}>
                      {item.title}
                    </div>
                    <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4">{item.desc}</p>
                    <div className="font-mono text-xs" style={{ color: item.color }}>{item.stat}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Game Modes */}
        <section className="py-20 relative">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Player vs AI */}
              <motion.div
                initial={{ x: -30, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                className="relative overflow-hidden clip-brutal-lg group"
              >
                <img src={AI_BATTLE_IMG} alt="Player vs AI" className="w-full h-64 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="font-display text-2xl font-bold text-neon-cyan text-glow-cyan mb-2">PLAYER vs AI</div>
                  <p className="font-sans text-sm text-foreground/70 mb-3">
                    Battle 4 AI agents in first-person combat. WASD movement, mouse aim, click to fire token projectiles.
                  </p>
                  <button
                    onClick={() => navigate("/arena")}
                    className="clip-brutal-sm px-4 py-2 bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan font-mono text-xs hover:bg-neon-cyan/30 transition-colors"
                  >
                    PLAY NOW →
                  </button>
                </div>
              </motion.div>

              {/* AI vs AI */}
              <motion.div
                initial={{ x: 30, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                className="relative overflow-hidden clip-brutal-lg group"
              >
                <img src={TOKEN_IMG} alt="AI vs AI Spectator" className="w-full h-64 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="font-display text-2xl font-bold text-neon-magenta text-glow-magenta mb-2">AI vs AI SPECTATOR</div>
                  <p className="font-sans text-sm text-foreground/70 mb-3">
                    Watch 6 autonomous AI agents battle for token supremacy. Observe emergent strategies and weapon choices.
                  </p>
                  <button
                    onClick={() => navigate("/arena")}
                    className="clip-brutal-sm px-4 py-2 bg-neon-magenta/20 border border-neon-magenta/40 text-neon-magenta font-mono text-xs hover:bg-neon-magenta/30 transition-colors"
                  >
                    SPECTATE →
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Bounty Targets */}
        <section className="py-20 relative">
          <div className="container">
            <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }}>
              <div className="text-center mb-12">
                <div className="text-[10px] font-mono text-neon-amber/70 uppercase tracking-[0.3em] mb-2">ETHDenver 2026</div>
                <h2 className="font-display text-3xl font-bold text-foreground tracking-wider">BOUNTY TARGETS</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    sponsor: "Blockade Labs",
                    bounty: "Solving the Homeless Agent Problem",
                    desc: "AI agents need environments to exist in. Skybox AI generates infinite 360° worlds for agents to inhabit, battle, and call home.",
                    tech: "Skybox AI API · 360° equirectangular rendering · Three.js skybox sphere",
                    color: "#00F0FF",
                  },
                  {
                    sponsor: "Base",
                    bounty: "Self-Sustaining Autonomous Agents",
                    desc: "Agents with real economic incentives. Every shot costs tokens, every hit earns tokens. The economy is the game.",
                    tech: "Base L2 · ERC-20 token ammo · On-chain settlement · Self-sustaining economy",
                    color: "#39FF14",
                  },
                  {
                    sponsor: "Kite AI",
                    bounty: "Agent-Native Payments & Identity",
                    desc: "Each AI agent has a unique ERC-8004 identity. Token transfers use x402 payment protocol. Agents are first-class economic actors.",
                    tech: "x402 payments · ERC-8004 identity · Agent-native transactions",
                    color: "#FFB800",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 30, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 }}
                    className="hud-panel clip-brutal p-6"
                  >
                    <div className="text-[9px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: item.color }}>
                      {item.sponsor}
                    </div>
                    <div className="font-display text-base font-bold text-foreground mb-3">{item.bounty}</div>
                    <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4">{item.desc}</p>
                    <div className="border-t border-border/20 pt-3">
                      <div className="text-[9px] font-mono text-muted-foreground/60">{item.tech}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="py-20 border-t border-border/20">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="text-[10px] font-mono text-neon-cyan/70 uppercase tracking-[0.3em] mb-2">Architecture</div>
                <h2 className="font-display text-3xl font-bold text-foreground tracking-wider mb-6">TECH STACK</h2>
                <div className="space-y-3">
                  {[
                    { label: "Rendering", value: "Three.js + Skybox AI equirectangular 360°", color: "#00F0FF" },
                    { label: "Environment", value: "Blockade Labs Skybox AI (Model 3)", color: "#00F0FF" },
                    { label: "Blockchain", value: "Base L2 (Ethereum L2)", color: "#39FF14" },
                    { label: "Payments", value: "x402 Protocol (Kite AI)", color: "#FFB800" },
                    { label: "Identity", value: "ERC-8004 Agent Identity Standard", color: "#FFB800" },
                    { label: "Token", value: "ERC-20 (Ammo/Currency)", color: "#39FF14" },
                    { label: "Frontend", value: "React + TypeScript + Tailwind CSS", color: "#FF00AA" },
                    { label: "Game Engine", value: "Custom Three.js FPS engine", color: "#FF00AA" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-1 h-1" style={{ backgroundColor: item.color }} />
                      <span className="font-mono text-xs text-muted-foreground w-24">{item.label}</span>
                      <span className="font-mono text-xs text-foreground/80">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token economy diagram */}
              <div className="hud-panel clip-brutal p-6">
                <div className="text-[10px] font-mono text-neon-green/70 uppercase tracking-[0.3em] mb-4">Token Flow</div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="clip-brutal-sm bg-neon-cyan/10 border border-neon-cyan/30 px-3 py-2 text-center min-w-[80px]">
                      <div className="font-mono text-xs text-neon-cyan">PLAYER</div>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-neon-cyan to-neon-magenta relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono text-neon-amber bg-background px-1">
                        FIRE (spend TKN)
                      </div>
                    </div>
                    <div className="clip-brutal-sm bg-neon-magenta/10 border border-neon-magenta/30 px-3 py-2 text-center min-w-[80px]">
                      <div className="font-mono text-xs text-neon-magenta">TARGET</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="clip-brutal-sm bg-neon-magenta/10 border border-neon-magenta/30 px-3 py-2 text-center min-w-[80px]">
                      <div className="font-mono text-xs text-neon-magenta">TARGET</div>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-neon-magenta to-neon-green relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono text-neon-green bg-background px-1">
                        HIT (collect TKN)
                      </div>
                    </div>
                    <div className="clip-brutal-sm bg-neon-green/10 border border-neon-green/30 px-3 py-2 text-center min-w-[80px]">
                      <div className="font-mono text-xs text-neon-green">WALLET</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="clip-brutal-sm bg-neon-green/10 border border-neon-green/30 px-3 py-2 text-center min-w-[80px]">
                      <div className="font-mono text-xs text-neon-green">WALLET</div>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-neon-green to-neon-amber relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-mono text-neon-amber bg-background px-1">
                        SHOP (upgrade)
                      </div>
                    </div>
                    <div className="clip-brutal-sm bg-neon-amber/10 border border-neon-amber/30 px-3 py-2 text-center min-w-[80px]">
                      <div className="font-mono text-xs text-neon-amber">ARMORY</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border/20 text-[8px] font-mono text-muted-foreground/50">
                  All token transfers settled on Base L2 via x402 protocol · Agent identity via ERC-8004
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-border/20">
          <div className="container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-neon-cyan" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
                <span className="font-display text-xs text-muted-foreground tracking-[0.2em]">TOKEN ARENA</span>
              </div>
              <div className="text-[9px] font-mono text-muted-foreground/50">
                ETHDenver 2026 · Built by coin_artist (Marguerite Decourcelle) · Powered by Skybox AI + Base L2 + Kite AI
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

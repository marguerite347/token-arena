import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import axios from "axios";
import {
  saveMatch, getRecentMatches, upsertLeaderboardEntry, getLeaderboard,
  cacheSkybox, updateSkyboxCache, getRandomCachedSkybox, getCachedSkyboxByStyleId, getAllCachedSkyboxes,
  getAgentIdentities, getAgentById, upsertAgentIdentity, updateAgentStats, updateAgentLoadout,
  logX402Transaction, getRecentX402Transactions, getX402TransactionsByMatch,
  saveAgentMemory, getAgentMemories,
  saveAgentDecision, getAgentDecisionHistory,
  seedMaterials, getAllMaterials, getMaterialByName,
  seedRecipes, getAvailableRecipes, getRecipeById, saveRecipe, getEmergentRecipes,
  saveCraftedItem, getCraftedItemsByAgent, getRecentCraftedItems, transferCraftedItem,
  getAgentInventoryItems, addToInventory, removeFromInventory,
  saveTrade, getRecentTrades,
  saveMetaSnapshot, getLatestMetaSnapshot, getMetaSnapshots,
} from "./db";
import { DEFAULT_AI_AGENTS } from "@shared/web3";
import { agentReason, executeAgentDecision, buildAgentPerformance } from "./agentBrain";
import { DEFAULT_MATERIALS, DEFAULT_RECIPES, generateEmergentRecipe, rollMaterialDrops } from "./craftingEngine";
import { runGameMasterAnalysis, buildDefaultMeta } from "./gameMaster";
import {
  initializeCouncil, getTreasuryBalance, recordFee, calculateFee,
  recordComputeSpend, checkAgentBankruptcy, killAgent, spawnAgent,
  councilDeliberate, playerVote, getEcosystemState, pruneAgentMemory,
  COUNCIL_MEMBERS, DEFAULT_FEES,
} from "./daoCouncil";
import {
  createPredictionMarket, placeBet, resolveMarket, generatePredictions,
  isGovernanceCooldownActive, getOpenMarkets, getMarketWithBets, getResolvedMarkets,
  takeEcosystemSnapshot, getEcosystemSnapshots,
} from "./predictionMarket";
import { analyzeArenaScene, getAgentSceneBriefing, getGameMasterSpawnContext, getPredictionContext, generateSceneGraph } from "./arenaVision";
import type { SceneAnalysis, SceneGraph } from "./arenaVision";
import { getSceneGraphBriefing, getSceneGraphItemContext, sceneGraphToLearningData } from "@shared/sceneGraph";
import { getAllFlywheelData, getAgentEconomics, getEcosystemHealth } from "./agentLifecycle";

// Blockade Labs Staging API — Model 4 styles (IDs 172-188)
const SKYBOX_API_BASE = "https://backend-staging.blockadelabs.com/api/v1/skybox";
const SKYBOX_IMAGINE_BASE = "https://backend-staging.blockadelabs.com/api/v1/imagine";
const SKYBOX_API_KEY = process.env.SKYBOX_API_KEY || "";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Skybox API Proxy ───────────────────────────────────────────────────────
  skybox: router({
    getStyles: publicProcedure.query(async () => {
      try {
        const res = await axios.get(`${SKYBOX_API_BASE}/styles`, {
          headers: { "x-api-key": SKYBOX_API_KEY },
        });
        return res.data as Array<{ id: number; name: string; model: string }>;
      } catch (e: any) {
        console.error("[Skybox] Failed to fetch styles:", e.message);
        return [];
      }
    }),
    generate: publicProcedure
      .input(z.object({
        prompt: z.string().min(1).max(600),
        styleId: z.number().default(89),
        enhancePrompt: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        try {
          console.log(`[Skybox Generate] prompt="${input.prompt.slice(0, 60)}..." styleId=${input.styleId}`);
          const res = await axios.post(`${SKYBOX_API_BASE}`, {
            prompt: input.prompt,
            skybox_style_id: input.styleId,
            enhance_prompt: input.enhancePrompt,
          }, {
            headers: { "x-api-key": SKYBOX_API_KEY, "Content-Type": "application/json" },
            timeout: 30000,
          });
          // POST /skybox returns data at top level (not wrapped in request)
          const data = res.data;
          console.log(`[Skybox Generate] Success! ID=${data.id} status=${data.status}`);
          await cacheSkybox({ prompt: input.prompt, styleId: input.styleId, skyboxId: data.id, status: data.status || "pending" });
          return {
            id: data.id, status: data.status,
            fileUrl: data.file_url || "", thumbUrl: data.thumb_url || "",
            depthMapUrl: data.depth_map_url || "",
            pusherChannel: data.pusher_channel || "", pusherEvent: data.pusher_event || "",
          };
        } catch (e: any) {
          console.error("[Skybox] Failed to generate:", e.message);
          throw new Error(`Skybox generation failed: ${e.message}`);
        }
      }),
    poll: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          const res = await axios.get(`${SKYBOX_IMAGINE_BASE}/requests/${input.id}`, {
            headers: { "x-api-key": SKYBOX_API_KEY },
            timeout: 15000,
          });
          // The poll endpoint wraps data in { request: { ... } }
          const data = res.data.request || res.data;
          console.log(`[Skybox Poll] ID=${input.id} status=${data.status} file_url=${data.file_url ? 'present' : 'empty'}`);
          return { id: data.id, status: data.status as string, fileUrl: data.file_url || "", thumbUrl: data.thumb_url || "", depthMapUrl: data.depth_map_url || "" };
        } catch (e: any) {
          console.error(`[Skybox Poll] Error for ID=${input.id}:`, e.message);
          return { id: input.id, status: "error", fileUrl: "", thumbUrl: "", depthMapUrl: "" };
        }
      }),
    getCached: publicProcedure.query(async () => getRandomCachedSkybox()),
    getCachedByStyle: publicProcedure
      .input(z.object({ styleId: z.number() }))
      .query(async ({ input }) => getCachedSkyboxByStyleId(input.styleId)),
    getAllCached: publicProcedure.query(async () => getAllCachedSkyboxes()),
    // Analyze a skybox image with vision LLM
    analyzeScene: publicProcedure
      .input(z.object({
        imageUrl: z.string().min(1).max(2048),
        arenaName: z.string().max(128).optional(),
        cacheId: z.number().optional(), // if provided, stores analysis in skybox cache
      }))
      .mutation(async ({ input }) => {
        console.log(`[ArenaVision] Analyzing scene: ${input.arenaName || "Unknown"} url=${input.imageUrl.slice(0, 60)}...`);
        const analysis = await analyzeArenaScene(input.imageUrl, input.arenaName);
        
        // Store in cache if cacheId provided
        if (input.cacheId) {
          await updateSkyboxCache(input.cacheId, { status: "complete", sceneAnalysis: analysis });
          console.log(`[ArenaVision] Stored analysis in cache ID=${input.cacheId}`);
        }
        
        return {
          analysis,
          agentBriefing: getAgentSceneBriefing(analysis),
          gameMasterContext: getGameMasterSpawnContext(analysis),
          predictionContext: getPredictionContext(analysis),
        };
      }),

    // Get cached scene analysis for a skybox
    getSceneAnalysis: publicProcedure
      .input(z.object({ styleId: z.number() }))
      .query(async ({ input }) => {
        const cached = await getCachedSkyboxByStyleId(input.styleId);
        if (!cached?.sceneAnalysis) return null;
        const analysis = cached.sceneAnalysis as SceneAnalysis;
        return {
          analysis,
          agentBriefing: getAgentSceneBriefing(analysis),
          gameMasterContext: getGameMasterSpawnContext(analysis),
          predictionContext: getPredictionContext(analysis),
        };
      }),

    // Generate a structured scene graph from a skybox image
    generateSceneGraph: publicProcedure
      .input(z.object({
        imageUrl: z.string().min(1).max(2048),
        arenaName: z.string().max(128).optional(),
        cacheId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        console.log(`[SceneGraph] Generating for "${input.arenaName || "Unknown"}" url=${input.imageUrl.slice(0, 60)}...`);
        const graph = await generateSceneGraph(input.imageUrl, input.arenaName);

        // Store in cache if cacheId provided
        if (input.cacheId) {
          await updateSkyboxCache(input.cacheId, { sceneGraph: graph });
          console.log(`[SceneGraph] Stored in cache ID=${input.cacheId}: ${graph.nodeCount} nodes, ${graph.edgeCount} edges`);
        }

        return {
          graph,
          agentBriefing: getSceneGraphBriefing(graph),
          itemContext: getSceneGraphItemContext(graph),
        };
      }),

    // Get cached scene graph for a skybox by style ID
    getSceneGraph: publicProcedure
      .input(z.object({ styleId: z.number() }))
      .query(async ({ input }) => {
        const cached = await getCachedSkyboxByStyleId(input.styleId);
        if (!cached?.sceneGraph) return null;
        const graph = cached.sceneGraph as SceneGraph;
        return {
          graph,
          agentBriefing: getSceneGraphBriefing(graph),
          itemContext: getSceneGraphItemContext(graph),
        };
      }),

    // Generate scene graph as post-match learning data for an agent
    sceneGraphToLearning: publicProcedure
      .input(z.object({
        styleId: z.number(),
        weaponUsed: z.string(),
        outcome: z.enum(["win", "loss"]),
        kills: z.number().int().min(0),
        deaths: z.number().int().min(0),
        nodeVisited: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const cached = await getCachedSkyboxByStyleId(input.styleId);
        if (!cached?.sceneGraph) return { learningData: null };
        const graph = cached.sceneGraph as SceneGraph;
        const learningData = sceneGraphToLearningData(graph, {
          weaponUsed: input.weaponUsed,
          outcome: input.outcome,
          kills: input.kills,
          deaths: input.deaths,
          nodeVisited: input.nodeVisited,
        });
        return { learningData };
      }),

    warmCache: protectedProcedure.mutation(async () => {
      // Pre-generate all 5 preset skyboxes in background
      const { ARENA_PROMPTS } = await import("@shared/arenaPrompts");
      const cached = await getAllCachedSkyboxes();
      const cachedStyleIds = new Set(cached.map(c => c.styleId));
      const toGenerate = ARENA_PROMPTS.filter(a => !cachedStyleIds.has(a.styleId));
      console.log(`[Skybox Cache] ${cached.length} cached, ${toGenerate.length} to generate`);
      
      // Fire off generation for uncached presets (don't await — run in background)
      for (const arena of toGenerate) {
        try {
          const res = await axios.post(`${SKYBOX_API_BASE}`, {
            prompt: arena.prompt,
            skybox_style_id: arena.styleId,
            enhance_prompt: true,
          }, {
            headers: { "x-api-key": SKYBOX_API_KEY, "Content-Type": "application/json" },
            timeout: 30000,
          });
          const data = res.data;
          const cacheId = await cacheSkybox({ prompt: arena.prompt, styleId: arena.styleId, skyboxId: data.id, status: "pending" });
          console.log(`[Skybox Cache] Queued ${arena.name} (ID=${data.id}, cacheId=${cacheId})`);
          
          // Poll in background
          (async () => {
            for (let i = 0; i < 40; i++) {
              await new Promise(r => setTimeout(r, 3000));
              try {
                const pollRes = await axios.get(`${SKYBOX_IMAGINE_BASE}/requests/${data.id}`, {
                  headers: { "x-api-key": SKYBOX_API_KEY },
                  timeout: 15000,
                });
                const pollData = pollRes.data.request || pollRes.data;
                if (pollData.status === "complete" && pollData.file_url) {
                  if (cacheId) {
                    await updateSkyboxCache(cacheId, {
                      skyboxId: data.id,
                      fileUrl: pollData.file_url,
                      thumbUrl: pollData.thumb_url || "",
                      depthMapUrl: pollData.depth_map_url || "",
                      status: "complete",
                    });
                  }
                  console.log(`[Skybox Cache] ✓ ${arena.name} cached successfully`);
                  break;
                }
                if (pollData.status === "error") {
                  console.error(`[Skybox Cache] ✗ ${arena.name} generation failed`);
                  break;
                }
              } catch { /* retry */ }
            }
          })();
          
          // Small delay between requests to avoid rate limiting
          await new Promise(r => setTimeout(r, 2000));
        } catch (e: any) {
          console.error(`[Skybox Cache] Failed to queue ${arena.name}:`, e.message);
        }
      }
      
      return { queued: toGenerate.length, alreadyCached: cached.length };
    }),
  }),

  // ─── Match History ──────────────────────────────────────────────────────────
  match: router({
    save: protectedProcedure
      .input(z.object({
        mode: z.string().min(1).max(32), duration: z.number().nonnegative().max(600),
        skyboxPrompt: z.string().max(600).optional(), skyboxUrl: z.string().max(2048).optional(),
        playerName: z.string().min(1).max(64), playerKills: z.number().int().nonnegative(), playerDeaths: z.number().int().nonnegative(),
        tokensEarned: z.number().nonnegative(), tokensSpent: z.number().nonnegative(), tokenNet: z.number(),
        result: z.string().min(1).max(32), weaponUsed: z.string().max(64).optional(),
        agentData: z.any().optional(), walletAddress: z.string().max(128).optional(),
      }))
      .mutation(async ({ input }) => {
        // Calculate and record match entry fee
        const entryFee = await calculateFee("match_entry", input.tokensEarned + input.tokensSpent);
        await recordFee("match_fee", entryFee, `Match entry fee from ${input.playerName}`);

        const id = await saveMatch({ ...input, entryFee });
        await upsertLeaderboardEntry({
          playerName: input.playerName, kills: input.playerKills, deaths: input.playerDeaths,
          tokensEarned: input.tokensEarned, tokensSpent: input.tokensSpent,
          won: input.result === "victory", weapon: input.weaponUsed || "plasma",
          walletAddress: input.walletAddress,
        });
        return { id, entryFee };
      }),
    recent: publicProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(async ({ input }) => getRecentMatches(input?.limit ?? 20)),
  }),

  // ─── Leaderboard ────────────────────────────────────────────────────────────
  leaderboard: router({
    get: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => getLeaderboard(input?.limit ?? 50)),
  }),

  // ─── Agent Identity (ERC-8004) ──────────────────────────────────────────────
  agent: router({
    list: publicProcedure.query(async () => {
      const agents = await getAgentIdentities();
      if (agents.length === 0) {
        for (const agent of DEFAULT_AI_AGENTS) {
          await upsertAgentIdentity({
            agentId: agent.agentId, name: agent.name, description: agent.description,
            owner: agent.owner, agentRegistry: agent.agentRegistry,
            reputation: Math.round(agent.reputation * 100),
            primaryWeapon: agent.loadout.primaryWeapon, secondaryWeapon: agent.loadout.secondaryWeapon,
            armor: agent.loadout.armor, metadata: agent.metadata,
          });
        }
        return getAgentIdentities();
      }
      return agents;
    }),
    get: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => getAgentById(input.agentId)),
    updateStats: publicProcedure
      .input(z.object({
        agentId: z.number(), kills: z.number().default(0), deaths: z.number().default(0),
        tokensEarned: z.number().default(0), tokensSpent: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        await updateAgentStats(input.agentId, { kills: input.kills, deaths: input.deaths, tokensEarned: input.tokensEarned, tokensSpent: input.tokensSpent });
        return { success: true };
      }),

    // ─── Autonomous Reasoning (costs compute) ─────────────────────────────
    reason: publicProcedure
      .input(z.object({ agentId: z.number(), styleId: z.number().optional() }))
      .mutation(async ({ input }) => {
        // Check compute budget
        const canAfford = await recordComputeSpend(input.agentId, "reasoning", 10, "Strategic reasoning about loadout and purchases");
        if (!canAfford) {
          // Check bankruptcy
          const bankStatus = await checkAgentBankruptcy(input.agentId);
          if (bankStatus.isBankrupt) {
            await killAgent(input.agentId, bankStatus.reason || "Cannot afford compute for reasoning");
            return { error: "Agent is bankrupt and has been terminated", bankrupt: true };
          }
          return { error: "Insufficient compute budget for reasoning" };
        }

        const perf = await buildAgentPerformance(input.agentId);
        if (!perf) return { error: "Agent not found" };

        // Inject scene graph context if arena styleId is provided
        if (input.styleId) {
          const cached = await getCachedSkyboxByStyleId(input.styleId);
          if (cached?.sceneGraph) {
            const graph = cached.sceneGraph as SceneGraph;
            perf.arenaContext = getSceneGraphBriefing(graph);
            console.log(`[AgentBrain] Injected scene graph for style ${input.styleId}: ${graph.nodeCount} nodes`);
          } else if (cached?.sceneAnalysis) {
            const analysis = cached.sceneAnalysis as SceneAnalysis;
            perf.arenaContext = getAgentSceneBriefing(analysis);
          }
        }

        const decision = await agentReason(perf);
        await executeAgentDecision(input.agentId, decision);

        if (decision.action === "change_loadout") {
          const [primary, secondary] = decision.target.split(",");
          if (primary) await updateAgentLoadout(input.agentId, { primaryWeapon: primary.trim(), secondaryWeapon: secondary?.trim() });
        }

        return {
          decision,
          performance: {
            winRate: perf.recentMatches.length > 0 ? perf.recentMatches.filter(m => m.won).length / perf.recentMatches.length : 0,
            tokenBalance: perf.totalTokenBalance,
          },
        };
      }),

    decisions: publicProcedure
      .input(z.object({ agentId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => getAgentDecisionHistory(input.agentId, input.limit)),

    memories: publicProcedure
      .input(z.object({ agentId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => getAgentMemories(input.agentId, input.limit)),

    inventory: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => getAgentInventoryItems(input.agentId)),

    // ─── Agent Lifecycle ──────────────────────────────────────────────────
    checkBankruptcy: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => checkAgentBankruptcy(input.agentId)),

    pruneMemory: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .mutation(async ({ input }) => pruneAgentMemory(input.agentId)),
  }),

  // ─── x402 Transactions ──────────────────────────────────────────────────────
  x402: router({
    log: publicProcedure
      .input(z.object({
        paymentId: z.string(), txHash: z.string(), action: z.string(),
        tokenSymbol: z.string(), amount: z.number(),
        fromAddress: z.string(), toAddress: z.string(),
        matchId: z.number().optional(), agentId: z.number().optional(),
        feeAmount: z.number().default(0), feeRecipient: z.string().optional(),
        success: z.number().default(1),
      }))
      .mutation(async ({ input }) => {
        const id = await logX402Transaction(input);
        // Record fee to treasury if applicable
        if (input.feeAmount > 0) {
          await recordFee("shop_fee", input.feeAmount, `x402 fee: ${input.action} ${input.tokenSymbol}`, input.agentId);
        }
        return { id };
      }),
    recent: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => getRecentX402Transactions(input?.limit ?? 50)),
    byMatch: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => getX402TransactionsByMatch(input.matchId)),
  }),

  // ─── Crafting System ────────────────────────────────────────────────────────
  crafting: router({
    init: publicProcedure.mutation(async () => {
      await seedMaterials(DEFAULT_MATERIALS);
      await seedRecipes(DEFAULT_RECIPES);
      return { success: true };
    }),
    materials: publicProcedure.query(async () => getAllMaterials()),
    recipes: publicProcedure.query(async () => getAvailableRecipes()),
    emergentRecipes: publicProcedure.query(async () => getEmergentRecipes()),
    recentItems: publicProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(async ({ input }) => getRecentCraftedItems(input?.limit ?? 20)),

    rollDrops: publicProcedure
      .input(z.object({ weaponUsed: z.string(), killStreak: z.number(), agentId: z.number() }))
      .mutation(async ({ input }) => {
        const drops = rollMaterialDrops(input.weaponUsed, input.killStreak);
        for (const drop of drops) {
          const mat = await getMaterialByName(drop.materialName);
          if (mat) {
            await addToInventory({ agentId: input.agentId, itemType: "material", itemId: mat.id, quantity: drop.quantity });
          }
        }
        return { drops };
      }),

    craft: publicProcedure
      .input(z.object({ recipeId: z.number(), agentId: z.number() }))
      .mutation(async ({ input }) => {
        const recipe = await getRecipeById(input.recipeId);
        if (!recipe) return { error: "Recipe not found" };

        // Crafting tax goes to DAO treasury
        const craftTax = await calculateFee("crafting_tax", recipe.craftingCost);
        await recordFee("craft_tax", craftTax, `Crafting tax: ${recipe.name} by agent ${input.agentId}`, input.agentId);

        const itemId = await saveCraftedItem({
          recipeId: recipe.id, craftedBy: input.agentId, ownedBy: input.agentId,
          itemType: recipe.resultType, itemName: recipe.resultName,
          stats: recipe.resultStats,
          rarity: recipe.craftingCost > 50 ? "epic" : recipe.craftingCost > 30 ? "rare" : "uncommon",
        });
        return { success: true, itemId, itemName: recipe.resultName, itemType: recipe.resultType, craftTax };
      }),

    discover: publicProcedure
      .input(z.object({ agentId: z.number(), agentName: z.string() }))
      .mutation(async ({ input }) => {
        // Discovery costs compute
        const canAfford = await recordComputeSpend(input.agentId, "craft_discover", 15, "Discovering new crafting recipe");
        if (!canAfford) return { success: false, error: "Insufficient compute budget for discovery" };

        const materials = await getAllMaterials();
        const recipes = await getAvailableRecipes();
        const meta = await getLatestMetaSnapshot();
        const metaContext = meta?.analysis || "Early game — no dominant strategies yet";

        const newRecipe = await generateEmergentRecipe(
          input.agentName, input.agentId,
          materials.map(m => m.name), recipes.map(r => r.name), metaContext,
        );

        if (newRecipe) {
          const id = await saveRecipe(newRecipe);
          return { success: true, recipe: { ...newRecipe, id } };
        }
        return { success: false, error: "Failed to generate recipe" };
      }),
  }),

  // ─── Trading System ─────────────────────────────────────────────────────────
  trade: router({
    execute: publicProcedure
      .input(z.object({
        sellerAgentId: z.number(), buyerAgentId: z.number(),
        itemType: z.string(), itemId: z.number(), price: z.number(),
      }))
      .mutation(async ({ input }) => {
        // Trade tax goes to DAO treasury
        const tradeTax = await calculateFee("trade_tax", input.price);
        await recordFee("trade_tax", tradeTax, `Trade tax: ${input.itemType} #${input.itemId}`, input.buyerAgentId);

        if (input.itemType === "crafted") {
          await transferCraftedItem(input.itemId, input.buyerAgentId);
        }
        const tradeId = await saveTrade({
          sellerAgentId: input.sellerAgentId, buyerAgentId: input.buyerAgentId,
          itemType: input.itemType, itemId: input.itemId, price: input.price, tradeTax,
        });
        return { success: true, tradeId, tradeTax };
      }),
    recent: publicProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(async ({ input }) => getRecentTrades(input?.limit ?? 20)),
  }),

  // ─── Master Game Design Agent → DAO Council ────────────────────────────────
  gameMaster: router({
    analyze: publicProcedure.mutation(async () => {
      const agents = await getAgentIdentities();
      const meta = buildDefaultMeta();

      meta.agentStrategies = agents.map(a => ({
        agentName: a.name,
        primaryWeapon: a.primaryWeapon ?? "plasma",
        winRate: (a.totalMatches ?? 0) > 0 ? ((a.totalKills ?? 0) / Math.max(1, (a.totalKills ?? 0) + (a.totalDeaths ?? 0))) : 0.5,
        tokenBalance: ((a.totalTokensEarned ?? 0) - (a.totalTokensSpent ?? 0)) + 200,
      }));

      const sustainableCount = meta.agentStrategies.filter(a => a.tokenBalance > 200).length;
      meta.economyStats.agentSustainabilityRate = agents.length > 0 ? sustainableCount / agents.length : 0.5;

      const decision = await runGameMasterAnalysis(meta);

      await saveMetaSnapshot({
        analysis: decision.analysis,
        dominantStrategy: decision.dominantStrategy,
        economyHealth: decision.economyHealth,
        actionsTaken: decision.actions,
        newItemsIntroduced: decision.newRecipe ? [decision.newRecipe] : null,
        balanceChanges: null,
        matchesAnalyzed: agents.length,
      });

      if (decision.newRecipe) {
        await saveRecipe({
          name: decision.newRecipe.name, description: decision.newRecipe.description,
          resultType: decision.newRecipe.resultType, resultName: decision.newRecipe.resultName,
          resultStats: decision.newRecipe.resultStats, ingredients: decision.newRecipe.ingredients,
          craftingCost: decision.newRecipe.craftingCost, discoveredBy: null, isEmergent: 1,
        });
      }

      return decision;
    }),
    latestSnapshot: publicProcedure.query(async () => getLatestMetaSnapshot()),
    history: publicProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => getMetaSnapshots(input?.limit ?? 10)),
  }),

  // ─── DAO Governance ─────────────────────────────────────────────────────────
  dao: router({
    // Initialize the DAO council and fee structure
    init: publicProcedure.mutation(async () => {
      const result = await initializeCouncil();
      return result;
    }),

    // Get full ecosystem state
    ecosystem: publicProcedure.query(async () => getEcosystemState()),

    // Get treasury balance
    treasury: publicProcedure.query(async () => getTreasuryBalance()),

    // Get council members
    council: publicProcedure.query(async () => {
      return COUNCIL_MEMBERS.map((m, i) => ({
        id: i + 1,
        name: m.name,
        philosophy: m.philosophy,
        description: m.description,
      }));
    }),

    // Council deliberation — all 5 members vote on a proposal
    deliberate: protectedProcedure
      .input(z.object({
        proposalType: z.string().min(1).max(64),
        context: z.string().min(1).max(1000),
      }))
      .mutation(async ({ input }) => {
        return councilDeliberate(input.proposalType, input.context);
      }),

    // Player vote on a proposal (weight based on ARENA balance)
    playerVote: publicProcedure
      .input(z.object({
        proposalId: z.number(),
        vote: z.enum(["for", "against"]),
        arenaBalance: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user?.id || 0;
        const userName = ctx.user?.name || "Anonymous";
        return playerVote(input.proposalId, userId, userName, input.vote, input.arenaBalance);
      }),

    // Spawn a new agent (requires DAO vote or treasury funds)
    spawnAgent: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(64),
        description: z.string().min(1).max(500),
        proposalId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return spawnAgent(input.name, input.description, input.proposalId);
      }),

    // Kill a bankrupt agent
    killAgent: protectedProcedure
      .input(z.object({
        agentId: z.number().int().positive(),
        reason: z.string().min(1).max(256),
      }))
      .mutation(async ({ input }) => {
        return killAgent(input.agentId, input.reason);
      }),

    // Record a fee to the treasury
    recordFee: protectedProcedure
      .input(z.object({
        txType: z.string().min(1).max(64),
        amount: z.number().positive().max(1_000_000),
        description: z.string().min(1).max(256),
        relatedAgentId: z.number().int().positive().optional(),
        relatedMatchId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input }) => {
        await recordFee(input.txType, input.amount, input.description, input.relatedAgentId, input.relatedMatchId);
        return { success: true };
      }),

    // Get current fee configuration
    fees: publicProcedure.query(async () => {
      return DEFAULT_FEES;
    }),

    // Calculate a specific fee
    calculateFee: publicProcedure
      .input(z.object({ feeType: z.string(), baseAmount: z.number() }))
      .query(async ({ input }) => {
        const fee = await calculateFee(input.feeType, input.baseAmount);
        return { fee };
      }),
  }),

  // ─── Prediction Market ───────────────────────────────────────────────────
  prediction: router({
    // Generate predictions using LLM (DAO oracle)
    generate: publicProcedure
      .input(z.object({
        councilMemberId: z.number().default(1),
        matchContext: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return generatePredictions(input);
      }),

    // Create a market from generated prediction
    createMarket: publicProcedure
      .input(z.object({
        councilMemberId: z.number(),
        marketType: z.string(),
        title: z.string(),
        description: z.string(),
        options: z.array(z.object({
          id: z.number(),
          label: z.string(),
          odds: z.number(),
        })),
        matchId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return createPredictionMarket(input);
      }),

    // Place a bet
    bet: publicProcedure
      .input(z.object({
        marketId: z.number().int().positive(),
        bettorType: z.enum(["player", "agent", "spectator"]),
        bettorId: z.string().min(1).max(128),
        bettorName: z.string().min(1).max(64),
        optionId: z.number().int().nonnegative(),
        amount: z.number().int().positive().max(1_000_000),
      }))
      .mutation(async ({ input }) => {
        return placeBet(input);
      }),

    // Resolve a market
    resolve: protectedProcedure
      .input(z.object({
        marketId: z.number().int().positive(),
        winningOptionId: z.number().int().nonnegative(),
      }))
      .mutation(async ({ input }) => {
        return resolveMarket(input);
      }),

    // Get open markets
    open: publicProcedure.query(async () => getOpenMarkets()),

    // Get market with bets
    detail: publicProcedure
      .input(z.object({ marketId: z.number() }))
      .query(async ({ input }) => getMarketWithBets(input.marketId)),

    // Get resolved markets
    resolved: publicProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => getResolvedMarkets(input?.limit ?? 10)),

    // Check governance cooldown (anti-manipulation)
    cooldown: publicProcedure.query(async () => isGovernanceCooldownActive()),
  }),

  // ─── Ecosystem Dashboard ─────────────────────────────────────────────────
  ecosystem: router({
    snapshot: publicProcedure.mutation(async () => takeEcosystemSnapshot()),
    history: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => getEcosystemSnapshots(input?.limit ?? 50)),
  }),

  // ─── Flywheel Dashboard ─────────────────────────────────────────────────
  flywheel: router({
    // Get all agents' flywheel data (earnings → compute → smarter → earn loop)
    all: publicProcedure.query(async () => {
      const data = await getAllFlywheelData();
      return data;
    }),

    // Get single agent economics
    agent: publicProcedure
      .input(z.object({ agentId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return getAgentEconomics(input.agentId);
      }),

    // Get ecosystem health metrics
    health: publicProcedure.query(async () => {
      return getEcosystemHealth();
    }),

    // Seed agent token balances by simulating AI vs AI matches
    // This populates real economic data for the Flywheel Dashboard
    seed: publicProcedure
      .input(z.object({
        matchCount: z.number().int().min(1).max(50).default(10),
      }).optional())
      .mutation(async ({ input }) => {
        const count = input?.matchCount ?? 10;
        const agents = await getAgentIdentities();
        if (agents.length === 0) {
          return { seeded: 0, message: "No agents found — run agent.list first to initialize agents" };
        }

        const WEAPONS = ["plasma", "railgun", "scatter", "missile", "beam", "nova", "void"];
        const ARENAS = ["Neon Brutalism", "Neon Colosseum", "Crypto Wasteland", "Digital Void", "Mech Hangar"];
        let matchesSeeded = 0;

        for (let i = 0; i < count; i++) {
          // Pick two random agents
          const shuffled = [...agents].sort(() => Math.random() - 0.5);
          const agent1 = shuffled[0];
          const agent2 = shuffled[1] || shuffled[0];
          const arena = ARENAS[Math.floor(Math.random() * ARENAS.length)];

          // Simulate match outcome — winner earns more
          const agent1Kills = Math.floor(Math.random() * 8) + 1;
          const agent2Kills = Math.floor(Math.random() * 8) + 1;
          const agent1Wins = agent1Kills > agent2Kills;

          // Token economics: winner earns 50-200 tokens, loser earns 10-50
          const winnerEarnings = Math.floor(Math.random() * 150) + 50;
          const loserEarnings = Math.floor(Math.random() * 40) + 10;
          const computeCost = Math.floor(Math.random() * 20) + 5; // LLM + memory costs
          const ammoCost = Math.floor(Math.random() * 15) + 3;    // Weapon token costs

          const agent1Earned = agent1Wins ? winnerEarnings : loserEarnings;
          const agent2Earned = agent1Wins ? loserEarnings : winnerEarnings;
          const agent1Spent = computeCost + ammoCost;
          const agent2Spent = Math.floor(computeCost * 0.8) + Math.floor(ammoCost * 0.9);

          // Update agent stats
          await updateAgentStats(agent1.agentId, {
            kills: agent1Kills, deaths: agent2Kills,
            tokensEarned: agent1Earned, tokensSpent: agent1Spent,
          });
          await updateAgentStats(agent2.agentId, {
            kills: agent2Kills, deaths: agent1Kills,
            tokensEarned: agent2Earned, tokensSpent: agent2Spent,
          });

          // Log x402 transactions for the match
          const txId = `seed-${Date.now()}-${i}`;
          await logX402Transaction({
            paymentId: `${txId}-a1`, txHash: `0x${txId.replace(/-/g, "")}a1`,
            action: "match_earnings", tokenSymbol: "ARENA", amount: agent1Earned,
            fromAddress: "0xArena", toAddress: agent1.owner || "0xAgent1",
            matchId: null, agentId: agent1.agentId, feeAmount: 0, success: 1,
          });
          await logX402Transaction({
            paymentId: `${txId}-a2`, txHash: `0x${txId.replace(/-/g, "")}a2`,
            action: "match_earnings", tokenSymbol: "ARENA", amount: agent2Earned,
            fromAddress: "0xArena", toAddress: agent2.owner || "0xAgent2",
            matchId: null, agentId: agent2.agentId, feeAmount: 0, success: 1,
          });

          matchesSeeded++;
        }

        const health = await getEcosystemHealth();
        return {
          seeded: matchesSeeded,
          message: `Seeded ${matchesSeeded} simulated matches across ${agents.length} agents`,
          ecosystemHealth: health,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;

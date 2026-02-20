import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import axios from "axios";
import {
  saveMatch, getRecentMatches, upsertLeaderboardEntry, getLeaderboard,
  cacheSkybox, updateSkyboxCache, getRandomCachedSkybox,
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

const SKYBOX_API_BASE = "https://backend.blockadelabs.com/api/v1";
const SKYBOX_API_KEY = process.env.SKYBOX_API_KEY || "IRmVFdJZMYrjtVBUgb2kq4Xp8YAKCQ4Hq4j8aGZCXYJVixoUFaWh8cwNezQU";

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
        const res = await axios.get(`${SKYBOX_API_BASE}/skybox/styles`, {
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
          const res = await axios.post(`${SKYBOX_API_BASE}/skybox`, {
            prompt: input.prompt,
            skybox_style_id: input.styleId,
            enhance_prompt: input.enhancePrompt,
          }, {
            headers: { "x-api-key": SKYBOX_API_KEY, "Content-Type": "application/json" },
          });
          const data = res.data;
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
          const res = await axios.get(`${SKYBOX_API_BASE}/imagine/requests/${input.id}`, {
            headers: { "x-api-key": SKYBOX_API_KEY },
          });
          const data = res.data;
          return { id: data.id, status: data.status as string, fileUrl: data.file_url || "", thumbUrl: data.thumb_url || "", depthMapUrl: data.depth_map_url || "" };
        } catch (e: any) {
          return { id: input.id, status: "error", fileUrl: "", thumbUrl: "", depthMapUrl: "" };
        }
      }),
    getCached: publicProcedure.query(async () => getRandomCachedSkybox()),
  }),

  // ─── Match History ──────────────────────────────────────────────────────────
  match: router({
    save: publicProcedure
      .input(z.object({
        mode: z.string(), duration: z.number(),
        skyboxPrompt: z.string().optional(), skyboxUrl: z.string().optional(),
        playerName: z.string(), playerKills: z.number(), playerDeaths: z.number(),
        tokensEarned: z.number(), tokensSpent: z.number(), tokenNet: z.number(),
        result: z.string(), weaponUsed: z.string().optional(),
        agentData: z.any().optional(), walletAddress: z.string().optional(),
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
      .input(z.object({ agentId: z.number() }))
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
    deliberate: publicProcedure
      .input(z.object({
        proposalType: z.string(),
        context: z.string(),
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
    spawnAgent: publicProcedure
      .input(z.object({
        name: z.string(),
        description: z.string(),
        proposalId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return spawnAgent(input.name, input.description, input.proposalId);
      }),

    // Kill a bankrupt agent
    killAgent: publicProcedure
      .input(z.object({
        agentId: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        return killAgent(input.agentId, input.reason);
      }),

    // Record a fee to the treasury
    recordFee: publicProcedure
      .input(z.object({
        txType: z.string(),
        amount: z.number(),
        description: z.string(),
        relatedAgentId: z.number().optional(),
        relatedMatchId: z.number().optional(),
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
});

export type AppRouter = typeof appRouter;

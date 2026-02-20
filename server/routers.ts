import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import axios from "axios";
import {
  saveMatch, getRecentMatches, upsertLeaderboardEntry, getLeaderboard,
  cacheSkybox, updateSkyboxCache, getRandomCachedSkybox,
  getAgentIdentities, getAgentById, upsertAgentIdentity, updateAgentStats,
  logX402Transaction, getRecentX402Transactions, getX402TransactionsByMatch,
} from "./db";
import { DEFAULT_AI_AGENTS } from "@shared/web3";

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
            headers: {
              "x-api-key": SKYBOX_API_KEY,
              "Content-Type": "application/json",
            },
          });

          const data = res.data;
          await cacheSkybox({
            prompt: input.prompt,
            styleId: input.styleId,
            skyboxId: data.id,
            status: data.status || "pending",
          });

          return {
            id: data.id,
            status: data.status,
            fileUrl: data.file_url || "",
            thumbUrl: data.thumb_url || "",
            depthMapUrl: data.depth_map_url || "",
            pusherChannel: data.pusher_channel || "",
            pusherEvent: data.pusher_event || "",
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
          return {
            id: data.id,
            status: data.status as string,
            fileUrl: data.file_url || "",
            thumbUrl: data.thumb_url || "",
            depthMapUrl: data.depth_map_url || "",
          };
        } catch (e: any) {
          console.error("[Skybox] Failed to poll:", e.message);
          return { id: input.id, status: "error", fileUrl: "", thumbUrl: "", depthMapUrl: "" };
        }
      }),

    getCached: publicProcedure.query(async () => {
      const cached = await getRandomCachedSkybox();
      return cached;
    }),
  }),

  // ─── Match History ──────────────────────────────────────────────────────────
  match: router({
    save: publicProcedure
      .input(z.object({
        mode: z.string(),
        duration: z.number(),
        skyboxPrompt: z.string().optional(),
        skyboxUrl: z.string().optional(),
        playerName: z.string(),
        playerKills: z.number(),
        playerDeaths: z.number(),
        tokensEarned: z.number(),
        tokensSpent: z.number(),
        tokenNet: z.number(),
        result: z.string(),
        weaponUsed: z.string().optional(),
        agentData: z.any().optional(),
        walletAddress: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await saveMatch(input);
        await upsertLeaderboardEntry({
          playerName: input.playerName,
          kills: input.playerKills,
          deaths: input.playerDeaths,
          tokensEarned: input.tokensEarned,
          tokensSpent: input.tokensSpent,
          won: input.result === "victory",
          weapon: input.weaponUsed || "plasma",
          walletAddress: input.walletAddress,
        });
        return { id };
      }),

    recent: publicProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(async ({ input }) => {
        return getRecentMatches(input?.limit ?? 20);
      }),
  }),

  // ─── Leaderboard ────────────────────────────────────────────────────────────
  leaderboard: router({
    get: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return getLeaderboard(input?.limit ?? 50);
      }),
  }),

  // ─── Agent Identity (ERC-8004) ──────────────────────────────────────────────
  agent: router({
    list: publicProcedure.query(async () => {
      const agents = await getAgentIdentities();
      if (agents.length === 0) {
        // Seed default agents on first call
        for (const agent of DEFAULT_AI_AGENTS) {
          await upsertAgentIdentity({
            agentId: agent.agentId,
            name: agent.name,
            description: agent.description,
            owner: agent.owner,
            agentRegistry: agent.agentRegistry,
            reputation: Math.round(agent.reputation * 100),
            primaryWeapon: agent.loadout.primaryWeapon,
            secondaryWeapon: agent.loadout.secondaryWeapon,
            armor: agent.loadout.armor,
            metadata: agent.metadata,
          });
        }
        return getAgentIdentities();
      }
      return agents;
    }),

    get: publicProcedure
      .input(z.object({ agentId: z.number() }))
      .query(async ({ input }) => {
        return getAgentById(input.agentId);
      }),

    updateStats: publicProcedure
      .input(z.object({
        agentId: z.number(),
        kills: z.number().default(0),
        deaths: z.number().default(0),
        tokensEarned: z.number().default(0),
        tokensSpent: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        await updateAgentStats(input.agentId, {
          kills: input.kills,
          deaths: input.deaths,
          tokensEarned: input.tokensEarned,
          tokensSpent: input.tokensSpent,
        });
        return { success: true };
      }),
  }),

  // ─── x402 Transactions ──────────────────────────────────────────────────────
  x402: router({
    log: publicProcedure
      .input(z.object({
        paymentId: z.string(),
        txHash: z.string(),
        action: z.string(),
        tokenSymbol: z.string(),
        amount: z.number(),
        fromAddress: z.string(),
        toAddress: z.string(),
        matchId: z.number().optional(),
        agentId: z.number().optional(),
        success: z.number().default(1),
      }))
      .mutation(async ({ input }) => {
        const id = await logX402Transaction(input);
        return { id };
      }),

    recent: publicProcedure
      .input(z.object({ limit: z.number().default(50) }).optional())
      .query(async ({ input }) => {
        return getRecentX402Transactions(input?.limit ?? 50);
      }),

    byMatch: publicProcedure
      .input(z.object({ matchId: z.number() }))
      .query(async ({ input }) => {
        return getX402TransactionsByMatch(input.matchId);
      }),
  }),
});

export type AppRouter = typeof appRouter;

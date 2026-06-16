import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { runSyncCompetition } from "./runSyncCompetition";

const syncCompetitionResultValidator = v.object({
  status: v.union(
    v.literal("synced"),
    v.literal("skipped"),
    v.literal("error"),
  ),
  path: v.string(),
  reason: v.optional(v.string()),
  message: v.optional(v.string()),
  matchCount: v.optional(v.number()),
});

export const syncCompetition = internalAction({
  args: {
    path: v.string(),
    force: v.optional(v.boolean()),
  },
  returns: syncCompetitionResultValidator,
  handler: async (ctx, args) => runSyncCompetition(ctx, args),
});

export const syncLinkedCompetitions = internalAction({
  args: {},
  returns: v.object({
    results: v.array(syncCompetitionResultValidator),
  }),
  handler: async (ctx) => {
    const paths: string[] = await ctx.runQuery(
      internal.football.internalQueries.listLinkedCompetitionPaths,
      {},
    );

    const results = [];
    for (const path of paths) {
      results.push(await runSyncCompetition(ctx, { path, force: false }));
    }

    console.log(
      JSON.stringify({
        event: "football_linked_competitions_sync",
        pathCount: paths.length,
        synced: results.filter((result) => result.status === "synced").length,
        skipped: results.filter((result) => result.status === "skipped").length,
        errors: results.filter((result) => result.status === "error").length,
      }),
    );

    return { results };
  },
});

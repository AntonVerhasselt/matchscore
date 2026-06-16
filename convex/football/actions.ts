import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

/** Kicks off the one-time club import chain (batched via scheduler). */
export const importAllClubs = internalAction({
  args: {
    skipCompleteClubs: v.optional(v.boolean()),
  },
  returns: v.object({
    scheduled: v.boolean(),
    startIndex: v.number(),
  }),
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(
      0,
      internal.football.internalActions.importClubBatch,
      {
        startIndex: 0,
        skipCompleteClubs: args.skipCompleteClubs ?? false,
      },
    );

    return {
      scheduled: true,
      startIndex: 0,
    };
  },
});

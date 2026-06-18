"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  mapVeoFailureToErrorData,
  validateVeoMatchForCompilation,
} from "./helpers";
import { createOrOpenJobResultValidator } from "./validators";

type CreateOrOpenJobResult = {
  jobId: Id<"veoPostJobs">;
  reopened: boolean;
};

export const createOrOpenJob = action({
  args: {
    veoMatchUrl: v.string(),
  },
  returns: createOrOpenJobResultValidator,
  handler: async (ctx, args): Promise<CreateOrOpenJobResult> => {
    const plan = await ctx.runQuery(
      internal.veoPosts.internalQueries.getCreateOrOpenPlan,
      { veoMatchUrl: args.veoMatchUrl },
    );

    if (plan.action === "open") {
      return {
        jobId: plan.jobId,
        reopened: plan.reopenCached,
      };
    }

    let validated;
    try {
      validated = await validateVeoMatchForCompilation(plan.veoMatchSlug);
    } catch (error) {
      throw new ConvexError(mapVeoFailureToErrorData(error));
    }

    const { match, goals, warningMessage } = validated;

    const jobId = await ctx.runMutation(
      internal.veoPosts.internalMutations.insertProcessingJob,
      {
        organizationId: plan.organizationId,
        createdByUserId: plan.createdByUserId,
        veoMatchSlug: plan.veoMatchSlug,
        veoMatchUrl: plan.veoMatchUrl,
        veoMatchTitle: match.title,
        veoClubName: match.clubName ?? undefined,
        veoOpponentName: match.opponentName ?? undefined,
        veoScoreOwn: match.scoreOwn ?? undefined,
        veoScoreOpponent: match.scoreOpponent ?? undefined,
        goalCount: goals.length,
        goalStartsSeconds: goals.map((goal) => goal.start),
        goalHighlightIds: goals.map((goal) => goal.id),
        warningMessage: warningMessage ?? undefined,
      },
    );

    return { jobId, reopened: false };
  },
});

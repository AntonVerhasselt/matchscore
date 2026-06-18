"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, type ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  mapVeoFailureToErrorData,
  validateVeoMatchForCompilation,
  type VeoHighlight,
} from "./helpers";
import { createOrOpenJobResultValidator } from "./validators";
import { submitGoalCompilationJob } from "./vgfClient";
import { VGF_POLL_FALLBACK_DELAY_MS } from "./vgfHelpers";

type CreateOrOpenJobResult = {
  jobId: Id<"veoPostJobs">;
  reopened: boolean;
};

async function startVgfPipeline(
  ctx: ActionCtx,
  jobId: Id<"veoPostJobs">,
  goals: Pick<VeoHighlight, "videos">[],
): Promise<void> {
  try {
    const vgffmpegJobId = await submitGoalCompilationJob({
      goals,
      veoPostJobId: jobId,
    });

    await ctx.runMutation(internal.veoPosts.internalMutations.attachVgfJobId, {
      jobId,
      vgffmpegJobId,
    });

    await ctx.scheduler.runAfter(
      VGF_POLL_FALLBACK_DELAY_MS,
      internal.veoPosts.internalActions.pollVgfJobIfPending,
      { jobId },
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Video compilation could not be started";
    await ctx.runMutation(internal.veoPosts.internalMutations.markFailed, {
      jobId,
      errorMessage,
    });
  }
}

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

    await startVgfPipeline(ctx, jobId, goals);

    return { jobId, reopened: false };
  },
});

export const regenerateJob = action({
  args: {
    jobId: v.id("veoPostJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(
      internal.veoPosts.internalQueries.getJobForRegeneration,
      { jobId: args.jobId },
    );

    if (!job) {
      throw new ConvexError("Goal highlight job not found");
    }

    if (
      job.status === "pending" ||
      job.status === "fetching" ||
      job.status === "processing"
    ) {
      throw new ConvexError("This compilation is already in progress");
    }

    let validated;
    try {
      validated = await validateVeoMatchForCompilation(job.veoMatchSlug);
    } catch (error) {
      throw new ConvexError(mapVeoFailureToErrorData(error));
    }

    const { match, goals, warningMessage } = validated;

    await ctx.runMutation(
      internal.veoPosts.internalMutations.resetJobForRegeneration,
      {
        jobId: args.jobId,
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

    await startVgfPipeline(ctx, args.jobId, goals);
    return null;
  },
});

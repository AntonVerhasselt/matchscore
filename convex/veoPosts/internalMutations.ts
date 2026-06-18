import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { DEFAULT_POSTING_CHANNEL_STATUSES } from "../automations/constants";

const insertProcessingJobArgsValidator = v.object({
  organizationId: v.id("organizations"),
  createdByUserId: v.string(),
  veoMatchSlug: v.string(),
  veoMatchUrl: v.string(),
  veoMatchTitle: v.string(),
  veoClubName: v.optional(v.string()),
  veoOpponentName: v.optional(v.string()),
  veoScoreOwn: v.optional(v.number()),
  veoScoreOpponent: v.optional(v.number()),
  goalCount: v.number(),
  goalStartsSeconds: v.array(v.number()),
  goalHighlightIds: v.array(v.string()),
  warningMessage: v.optional(v.string()),
});

async function getJobOrThrow(
  ctx: {
    db: {
      get: (
        table: "veoPostJobs",
        id: Id<"veoPostJobs">,
      ) => Promise<Doc<"veoPostJobs"> | null>;
    };
  },
  jobId: Id<"veoPostJobs">,
): Promise<Doc<"veoPostJobs">> {
  const job = await ctx.db.get("veoPostJobs", jobId);
  if (!job) {
    throw new ConvexError("Goal highlight job not found");
  }
  return job;
}

export const insertProcessingJob = internalMutation({
  args: insertProcessingJobArgsValidator,
  returns: v.id("veoPostJobs"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("veoPostJobs", {
      organizationId: args.organizationId,
      createdByUserId: args.createdByUserId,
      veoMatchSlug: args.veoMatchSlug,
      veoMatchUrl: args.veoMatchUrl,
      veoMatchTitle: args.veoMatchTitle,
      veoClubName: args.veoClubName,
      veoOpponentName: args.veoOpponentName,
      veoScoreOwn: args.veoScoreOwn,
      veoScoreOpponent: args.veoScoreOpponent,
      goalCount: args.goalCount,
      goalStartsSeconds: args.goalStartsSeconds,
      goalHighlightIds: args.goalHighlightIds,
      warningMessage: args.warningMessage,
      postingChannels: DEFAULT_POSTING_CHANNEL_STATUSES,
      status: "processing",
      createdAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: {
    jobId: v.id("veoPostJobs"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);
    if (job.status === "ready") {
      return null;
    }

    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: args.errorMessage,
      failedAt: Date.now(),
    });
    return null;
  },
});

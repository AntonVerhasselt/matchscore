import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { DEFAULT_POSTING_CHANNEL_STATUSES } from "../automations/constants";
import { listVeoPostJobsBySlug } from "./access";
import { resolveExistingJob } from "./helpers";
import { VGF_JOB_RETENTION_MS } from "./vgfHelpers";
import { goalHighlightsR2 } from "./r2Client";

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
  returns: v.object({
    jobId: v.id("veoPostJobs"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existingJobs = await listVeoPostJobsBySlug(
      ctx,
      args.organizationId,
      args.veoMatchSlug,
    );
    const dedupe = resolveExistingJob(
      existingJobs.map((job) => ({
        _id: job._id,
        status: job.status,
        outputR2Key: job.outputR2Key,
        expiresAt: job.expiresAt,
        createdAt: job.createdAt,
      })),
      Date.now(),
    );

    if (dedupe.action === "open") {
      return { jobId: dedupe.jobId, created: false };
    }

    const jobId = await ctx.db.insert("veoPostJobs", {
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
    return { jobId, created: true };
  },
});

export const attachVgfJobId = internalMutation({
  args: {
    jobId: v.id("veoPostJobs"),
    vgffmpegJobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getJobOrThrow(ctx, args.jobId);
    await ctx.db.patch(args.jobId, {
      vgffmpegJobId: args.vgffmpegJobId,
    });
    return null;
  },
});

export const markReady = internalMutation({
  args: {
    jobId: v.id("veoPostJobs"),
    outputR2Key: v.string(),
    outputByteSize: v.optional(v.number()),
    outputDurationSeconds: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);
    if (job.status === "ready" && job.outputR2Key) {
      return null;
    }

    const completedAt = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "ready",
      outputR2Key: args.outputR2Key,
      outputByteSize: args.outputByteSize,
      outputDurationSeconds: args.outputDurationSeconds,
      completedAt,
      expiresAt: completedAt + VGF_JOB_RETENTION_MS,
      errorMessage: undefined,
      failedAt: undefined,
    });
    return null;
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

const resetJobForRegenerationArgsValidator = v.object({
  jobId: v.id("veoPostJobs"),
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

export const resetJobForRegeneration = internalMutation({
  args: resetJobForRegenerationArgsValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await getJobOrThrow(ctx, args.jobId);

    if (
      job.status === "pending" ||
      job.status === "fetching" ||
      job.status === "processing"
    ) {
      throw new ConvexError("This compilation is already in progress");
    }

    if (job.outputR2Key) {
      try {
        await goalHighlightsR2.deleteObject(ctx, job.outputR2Key);
      } catch (error) {
        console.warn(
          "Failed to delete previous goal highlight video from R2",
          job._id,
          job.outputR2Key,
          error,
        );
        throw error;
      }
    }

    await ctx.db.patch(args.jobId, {
      status: "processing",
      veoMatchTitle: args.veoMatchTitle,
      veoClubName: args.veoClubName,
      veoOpponentName: args.veoOpponentName,
      veoScoreOwn: args.veoScoreOwn,
      veoScoreOpponent: args.veoScoreOpponent,
      goalCount: args.goalCount,
      goalStartsSeconds: args.goalStartsSeconds,
      goalHighlightIds: args.goalHighlightIds,
      warningMessage: args.warningMessage,
      outputR2Key: undefined,
      outputByteSize: undefined,
      outputDurationSeconds: undefined,
      vgffmpegJobId: undefined,
      errorMessage: undefined,
      failedAt: undefined,
      completedAt: undefined,
      expiresAt: undefined,
    });
    return null;
  },
});

export const expireStoredVideos = internalMutation({
  args: {},
  returns: v.object({
    clearedCount: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const expiredJobs = await ctx.db
      .query("veoPostJobs")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect();

    let clearedCount = 0;

    for (const job of expiredJobs) {
      if (!job.outputR2Key) {
        continue;
      }

      try {
        await goalHighlightsR2.deleteObject(ctx, job.outputR2Key);
        await ctx.db.patch(job._id, {
          outputR2Key: undefined,
          outputByteSize: undefined,
          outputDurationSeconds: undefined,
          expiresAt: undefined,
        });
        clearedCount += 1;
      } catch (error) {
        console.warn(
          "Failed to delete expired goal highlight video from R2",
          job._id,
          job.outputR2Key,
          error,
        );
      }
    }

    return { clearedCount };
  },
});

type LegacyVeoPostJob = Doc<"veoPostJobs"> & {
  outputStorageId?: Id<"_storage">;
};

/** One-time cleanup for highlight videos stored in Convex file storage before R2 migration. */
export const clearLegacyConvexHighlightVideos = internalMutation({
  args: {},
  returns: v.object({
    deletedBlobCount: v.number(),
  }),
  handler: async (ctx) => {
    const jobs = await ctx.db.query("veoPostJobs").collect();

    let deletedBlobCount = 0;

    for (const job of jobs) {
      const legacyStorageId = (job as LegacyVeoPostJob).outputStorageId;
      if (!legacyStorageId) {
        continue;
      }

      try {
        await ctx.storage.delete(legacyStorageId);
        deletedBlobCount += 1;
      } catch (error) {
        console.warn(
          "Failed to delete legacy goal highlight Convex blob",
          job._id,
          legacyStorageId,
          error,
        );
      }
    }

    return { deletedBlobCount };
  },
});

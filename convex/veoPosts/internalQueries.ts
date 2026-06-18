import { ConvexError, v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { requireCurrentMembership } from "../automations/helpers";
import { listVeoPostJobsBySlug } from "./access";
import { parseVeoMatchSlug, resolveExistingJob, veoPostErrorData } from "./helpers";

const openPlanValidator = v.object({
  action: v.literal("open"),
  jobId: v.id("veoPostJobs"),
  reopenCached: v.boolean(),
});

const createPlanValidator = v.object({
  action: v.literal("create"),
  veoMatchSlug: v.string(),
  veoMatchUrl: v.string(),
  organizationId: v.id("organizations"),
  createdByUserId: v.string(),
});

export const getCreateOrOpenPlan = internalQuery({
  args: {
    veoMatchUrl: v.string(),
  },
  returns: v.union(openPlanValidator, createPlanValidator),
  handler: async (ctx, args) => {
    const { user, membership } = await requireCurrentMembership(ctx);

    const veoMatchSlug = parseVeoMatchSlug(args.veoMatchUrl);
    if (!veoMatchSlug) {
      throw new ConvexError(veoPostErrorData("invalid_url"));
    }

    const existingJobs = await listVeoPostJobsBySlug(
      ctx,
      membership.organizationId,
      veoMatchSlug,
    );
    const dedupe = resolveExistingJob(
      existingJobs.map((job) => ({
        _id: job._id,
        status: job.status,
        outputStorageId: job.outputStorageId,
        expiresAt: job.expiresAt,
        createdAt: job.createdAt,
      })),
      Date.now(),
    );

    if (dedupe.action === "open") {
      return {
        action: "open" as const,
        jobId: dedupe.jobId,
        reopenCached: dedupe.reopenCached,
      };
    }

    return {
      action: "create" as const,
      veoMatchSlug,
      veoMatchUrl: args.veoMatchUrl.trim(),
      organizationId: membership.organizationId,
      createdByUserId: user._id,
    };
  },
});

const jobForProcessingValidator = v.union(
  v.object({
    _id: v.id("veoPostJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    vgffmpegJobId: v.union(v.string(), v.null()),
  }),
  v.null(),
);

export const getJobForProcessing = internalQuery({
  args: {
    jobId: v.id("veoPostJobs"),
  },
  returns: jobForProcessingValidator,
  handler: async (ctx, args) => {
    const job = await ctx.db.get("veoPostJobs", args.jobId);
    if (!job) {
      return null;
    }

    return {
      _id: job._id,
      status: job.status,
      vgffmpegJobId: job.vgffmpegJobId ?? null,
    };
  },
});

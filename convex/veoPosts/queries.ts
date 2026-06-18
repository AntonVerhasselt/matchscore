import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  listVeoPostJobsForOrganization,
} from "./access";
import {
  veoPostJobDetailValidator,
  veoPostJobSummaryValidator,
} from "./validators";
import { requireCurrentMembership } from "../automations/helpers";

function jobHasStoredVideo(job: { outputStorageId?: string }): boolean {
  return job.outputStorageId !== undefined;
}

function jobVideoExpired(job: {
  status: string;
  outputStorageId?: string;
  completedAt?: number;
}): boolean {
  return (
    job.status === "ready" &&
    job.completedAt !== undefined &&
    job.outputStorageId === undefined
  );
}

function toJobSummary(
  job: Awaited<ReturnType<typeof listVeoPostJobsForOrganization>>[number],
) {
  return {
    _id: job._id,
    veoMatchSlug: job.veoMatchSlug,
    veoMatchTitle: job.veoMatchTitle ?? null,
    status: job.status,
    goalCount: job.goalCount ?? null,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt ?? null,
    hasVideo: jobHasStoredVideo(job),
    videoExpired: jobVideoExpired(job),
    errorMessage: job.errorMessage ?? null,
  };
}

function toJobDetail(
  job: Awaited<ReturnType<typeof listVeoPostJobsForOrganization>>[number],
  outputVideoUrl: string | null,
) {
  const hasVideo = jobHasStoredVideo(job);
  return {
    _id: job._id,
    organizationId: job.organizationId,
    veoMatchSlug: job.veoMatchSlug,
    veoMatchUrl: job.veoMatchUrl,
    veoMatchTitle: job.veoMatchTitle ?? null,
    veoClubName: job.veoClubName ?? null,
    veoOpponentName: job.veoOpponentName ?? null,
    veoScoreOwn: job.veoScoreOwn ?? null,
    veoScoreOpponent: job.veoScoreOpponent ?? null,
    draftCaption: job.draftCaption ?? null,
    postingChannels: job.postingChannels,
    status: job.status,
    goalCount: job.goalCount ?? null,
    goalStartsSeconds: job.goalStartsSeconds ?? null,
    warningMessage: job.warningMessage ?? null,
    errorMessage: job.errorMessage ?? null,
    outputStorageId: job.outputStorageId ?? null,
    outputVideoUrl: hasVideo ? outputVideoUrl : null,
    hasVideo,
    videoExpired: jobVideoExpired(job),
    createdAt: job.createdAt,
    completedAt: job.completedAt ?? null,
    failedAt: job.failedAt ?? null,
    expiresAt: job.expiresAt ?? null,
  };
}

export const listJobs = query({
  args: {},
  returns: v.array(veoPostJobSummaryValidator),
  handler: async (ctx) => {
    const { membership } = await requireCurrentMembership(ctx);
    const jobs = await listVeoPostJobsForOrganization(
      ctx,
      membership.organizationId,
    );
    return jobs.map(toJobSummary);
  },
});

export const getJob = query({
  args: {
    jobId: v.id("veoPostJobs"),
  },
  returns: v.union(veoPostJobDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    const job = await ctx.db.get("veoPostJobs", args.jobId);

    if (!job || job.organizationId !== membership.organizationId) {
      return null;
    }

    const outputVideoUrl =
      job.outputStorageId && jobHasStoredVideo(job)
        ? ((await ctx.storage.getUrl(job.outputStorageId)) ?? null)
        : null;

    return toJobDetail(job, outputVideoUrl);
  },
});

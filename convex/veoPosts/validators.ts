import { v } from "convex/values";
import { postingChannelStatusesValidator } from "../automations/validators";

export const veoPostJobStatusValidator = v.union(
  v.literal("pending"),
  v.literal("fetching"),
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed"),
);

export const veoPostJobSummaryValidator = v.object({
  _id: v.id("veoPostJobs"),
  veoMatchSlug: v.string(),
  veoMatchTitle: v.union(v.string(), v.null()),
  status: veoPostJobStatusValidator,
  goalCount: v.union(v.number(), v.null()),
  createdAt: v.number(),
  expiresAt: v.union(v.number(), v.null()),
  hasVideo: v.boolean(),
  videoExpired: v.boolean(),
  errorMessage: v.union(v.string(), v.null()),
});

export const veoPostJobDetailValidator = v.object({
  _id: v.id("veoPostJobs"),
  organizationId: v.id("organizations"),
  veoMatchSlug: v.string(),
  veoMatchUrl: v.string(),
  veoMatchTitle: v.union(v.string(), v.null()),
  veoClubName: v.union(v.string(), v.null()),
  veoOpponentName: v.union(v.string(), v.null()),
  veoScoreOwn: v.union(v.number(), v.null()),
  veoScoreOpponent: v.union(v.number(), v.null()),
  draftCaption: v.union(v.string(), v.null()),
  postingChannels: postingChannelStatusesValidator,
  status: veoPostJobStatusValidator,
  goalCount: v.union(v.number(), v.null()),
  goalStartsSeconds: v.union(v.array(v.number()), v.null()),
  warningMessage: v.union(v.string(), v.null()),
  errorMessage: v.union(v.string(), v.null()),
  outputStorageId: v.union(v.id("_storage"), v.null()),
  outputVideoUrl: v.union(v.string(), v.null()),
  hasVideo: v.boolean(),
  videoExpired: v.boolean(),
  createdAt: v.number(),
  completedAt: v.union(v.number(), v.null()),
  failedAt: v.union(v.number(), v.null()),
  expiresAt: v.union(v.number(), v.null()),
});

export const createOrOpenJobResultValidator = v.object({
  jobId: v.id("veoPostJobs"),
  reopened: v.boolean(),
});

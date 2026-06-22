import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { normalizePostingChannelStatuses } from "../automations/constants";
import { postingChannelValidator } from "../automations/validators";
import { MAX_DRAFT_CAPTION_LENGTH } from "../../lib/goal-highlights/constants";
import { requireVeoPostJobForOrganization } from "./access";
import { goalHighlightsR2 } from "./r2Client";

export const updateDraftCaption = mutation({
  args: {
    jobId: v.id("veoPostJobs"),
    draftCaption: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireVeoPostJobForOrganization(ctx, args.jobId);

    if (args.draftCaption.length > MAX_DRAFT_CAPTION_LENGTH) {
      throw new ConvexError(
        `Caption must be ${MAX_DRAFT_CAPTION_LENGTH} characters or fewer`,
      );
    }

    await ctx.db.patch(args.jobId, {
      draftCaption: args.draftCaption,
    });
    return null;
  },
});

export const setPostingChannelEnabled = mutation({
  args: {
    jobId: v.id("veoPostJobs"),
    postingChannel: postingChannelValidator,
    isEnabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { job } = await requireVeoPostJobForOrganization(ctx, args.jobId);

    await ctx.db.patch(args.jobId, {
      postingChannels: {
        ...normalizePostingChannelStatuses(job.postingChannels),
        [args.postingChannel]: args.isEnabled,
      },
    });
    return null;
  },
});

export const deleteJob = mutation({
  args: {
    jobId: v.id("veoPostJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { job } = await requireVeoPostJobForOrganization(ctx, args.jobId);

    if (job.outputR2Key) {
      try {
        await goalHighlightsR2.deleteObject(ctx, job.outputR2Key);
      } catch (error) {
        console.warn(
          "Failed to delete goal highlight video from R2",
          job._id,
          job.outputR2Key,
          error,
        );
        throw error;
      }
    }

    await ctx.db.delete(args.jobId);
    return null;
  },
});

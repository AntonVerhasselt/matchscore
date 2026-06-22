"use node";

import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  getVgfOutputFileUrl,
  normalizeVgfJobPayload,
  type NormalizedVgfJob,
  VGF_OUTPUT_FILENAME,
} from "./vgfHelpers";
import { createVgfClient } from "./vgfClient";
import { downloadVgfOutputToR2 } from "./downloadVgfOutputToR2";

async function processTerminalVgfJob(
  ctx: ActionCtx,
  jobId: Id<"veoPostJobs">,
  vgfJob: NormalizedVgfJob,
): Promise<void> {
  if (vgfJob.status === "failed" || vgfJob.status === "cancelled") {
    await ctx.runMutation(internal.veoPosts.internalMutations.markFailed, {
      jobId,
      errorMessage:
        vgfJob.errorMessage.trim() ||
        "Video compilation failed. Please try again.",
    });
    return;
  }

  if (vgfJob.status !== "succeeded") {
    return;
  }

  const outputUrl = getVgfOutputFileUrl(vgfJob);
  if (!outputUrl) {
    await ctx.runMutation(internal.veoPosts.internalMutations.markFailed, {
      jobId,
      errorMessage: `Compiled video output "${VGF_OUTPUT_FILENAME}" was missing from the processing job.`,
    });
    return;
  }

  let r2Key: string;
  let byteSize: number;

  try {
    ({ r2Key, byteSize } = await downloadVgfOutputToR2(
      ctx,
      jobId,
      outputUrl,
      vgfJob.totalOutputBytes,
    ));
  } catch (firstError) {
    try {
      ({ r2Key, byteSize } = await downloadVgfOutputToR2(
        ctx,
        jobId,
        outputUrl,
        vgfJob.totalOutputBytes,
      ));
    } catch {
      await ctx.runMutation(internal.veoPosts.internalMutations.markFailed, {
        jobId,
        errorMessage:
          firstError instanceof Error
            ? firstError.message
            : "Could not save the compiled video",
      });
      return;
    }
  }

  await ctx.runMutation(internal.veoPosts.internalMutations.markReady, {
    jobId,
    outputR2Key: r2Key,
    outputByteSize: byteSize > 0 ? byteSize : (vgfJob.totalOutputBytes ?? undefined),
  });
}

export const handleVgfWebhook = internalAction({
  args: {
    jobId: v.id("veoPostJobs"),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const vgfJob = normalizeVgfJobPayload(args.payload);
    if (!vgfJob) {
      console.error("Invalid VGF webhook payload for job", args.jobId);
      return null;
    }

    const job = await ctx.runQuery(internal.veoPosts.internalQueries.getJobForProcessing, {
      jobId: args.jobId,
    });
    if (!job) {
      console.error("VGF webhook referenced unknown job", args.jobId);
      return null;
    }

    if (job.status === "ready" && job.outputR2Key) {
      return null;
    }

    if (job.vgffmpegJobId && job.vgffmpegJobId !== vgfJob.id) {
      console.error("VGF webhook job id mismatch", {
        expected: job.vgffmpegJobId,
        received: vgfJob.id,
      });
      return null;
    }

    await processTerminalVgfJob(ctx, args.jobId, vgfJob);
    return null;
  },
});

export const pollVgfJobIfPending = internalAction({
  args: {
    jobId: v.id("veoPostJobs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.veoPosts.internalQueries.getJobForProcessing, {
      jobId: args.jobId,
    });
    if (!job || job.status !== "processing" || !job.vgffmpegJobId) {
      return null;
    }

    const client = createVgfClient();
    const vgfJob = await client.jobs.get(job.vgffmpegJobId);

    if (vgfJob.status === "queued" || vgfJob.status === "running") {
      return null;
    }

    await processTerminalVgfJob(ctx, args.jobId, {
      id: vgfJob.id,
      status: vgfJob.status,
      outputFiles: vgfJob.output_files,
      errorMessage: vgfJob.error_message,
      totalOutputBytes: vgfJob.total_output_bytes,
    });

    return null;
  },
});

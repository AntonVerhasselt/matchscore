"use node";

import VGF from "@verygoodffmpeg/sdk";

import type { VeoHighlight } from "./helpers";
import {
  buildGoalInputFiles,
  buildVgfFfmpegCommand,
  buildVgfWebhookUrl,
} from "./vgfHelpers";
import { getConvexSiteUrl } from "./convexSiteUrl";

function requireVgfApiKey(): string {
  const apiKey = process.env.VGFFMPEG_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("VGFFMPEG_API_KEY is not configured");
  }
  return apiKey;
}

export function createVgfClient(): VGF {
  return new VGF(requireVgfApiKey());
}

export async function submitGoalCompilationJob(args: {
  goals: Pick<VeoHighlight, "videos">[];
  veoPostJobId: string;
}): Promise<string> {
  const inputFiles = buildGoalInputFiles(args.goals);
  const { ffmpegCommands, outputFiles } = buildVgfFfmpegCommand(inputFiles);
  const webhookUrl = buildVgfWebhookUrl(getConvexSiteUrl(), args.veoPostJobId);

  const client = createVgfClient();
  const job = await client.run(
    {
      input_files: inputFiles,
      output_files: outputFiles,
      ffmpeg_commands: ffmpegCommands,
      webhook_url: webhookUrl,
      machine: "cpu",
    },
    { wait: false },
  );

  return job.id;
}

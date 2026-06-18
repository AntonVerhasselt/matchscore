import type { VeoHighlight } from "./helpers";

export const VGF_OUTPUT_FILENAME = "goals.mp4";

export const VGF_JOB_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export const VGF_POLL_FALLBACK_DELAY_MS = 10 * 60 * 1000;

export type NormalizedVgfJob = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  outputFiles: Record<string, string>;
  errorMessage: string;
  totalOutputBytes: number | null;
};

export function buildGoalInputFiles(
  goalHighlights: Pick<VeoHighlight, "videos">[],
): Record<string, string> {
  return Object.fromEntries(
    goalHighlights.map((highlight, index) => {
      const url = highlight.videos[0]?.url;
      if (!url) {
        throw new Error(`Goal clip ${index + 1} is missing a video URL`);
      }
      return [`goal${index + 1}.mp4`, url];
    }),
  );
}

export function buildVgfFfmpegCommand(
  inputFiles: Record<string, string>,
): { ffmpegCommands: string[]; outputFiles: string[] } {
  const entries = Object.entries(inputFiles);
  const count = entries.length;
  if (count < 1) {
    throw new Error("At least one goal clip is required");
  }

  if (count === 1) {
    const [inputName] = entries[0]!;
    return {
      ffmpegCommands: [
        `-i {{${inputName}}} -c:v libx264 -crf 23 -preset fast -c:a aac {{${VGF_OUTPUT_FILENAME}}}`,
      ],
      outputFiles: [VGF_OUTPUT_FILENAME],
    };
  }

  const inputs = entries.map(([name]) => `-i {{${name}}}`).join(" ");
  const filterInputs = Array.from({ length: count }, (_, index) => `[${index}:v][${index}:a]`).join(
    "",
  );
  const filter = `${filterInputs}concat=n=${count}:v=1:a=1[outv][outa]`;
  const command =
    `${inputs} -filter_complex "${filter}" -map "[outv]" -map "[outa]" ` +
    `-c:v libx264 -crf 23 -preset fast {{${VGF_OUTPUT_FILENAME}}}`;

  return {
    ffmpegCommands: [command],
    outputFiles: [VGF_OUTPUT_FILENAME],
  };
}

export function buildVgfWebhookUrl(siteUrl: string, jobId: string): string {
  const url = new URL("/webhooks/vgffmpeg", siteUrl);
  url.searchParams.set("jobId", jobId);
  return url.toString();
}

export function normalizeVgfJobPayload(payload: unknown): NormalizedVgfJob | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;

  const id = data.id;
  const status = data.status;
  if (typeof id !== "string" || typeof status !== "string") {
    return null;
  }

  if (
    status !== "queued" &&
    status !== "running" &&
    status !== "succeeded" &&
    status !== "failed" &&
    status !== "cancelled"
  ) {
    return null;
  }

  const outputFiles: Record<string, string> = {};
  if (data.output_files && typeof data.output_files === "object") {
    for (const [key, value] of Object.entries(
      data.output_files as Record<string, unknown>,
    )) {
      if (typeof value === "string") {
        outputFiles[key] = value;
      }
    }
  }

  return {
    id,
    status,
    outputFiles,
    errorMessage:
      typeof data.error_message === "string" ? data.error_message : "",
    totalOutputBytes:
      typeof data.total_output_bytes === "number" ? data.total_output_bytes : null,
  };
}

export function getVgfOutputFileUrl(job: NormalizedVgfJob): string | null {
  return job.outputFiles[VGF_OUTPUT_FILENAME] ?? null;
}

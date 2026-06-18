import { describe, expect, test } from "vitest";
import {
  buildGoalInputFiles,
  buildVgfFfmpegCommand,
  buildVgfWebhookUrl,
  getVgfOutputFileUrl,
  normalizeVgfJobPayload,
  VGF_OUTPUT_FILENAME,
} from "./vgfHelpers";
import type { VeoHighlight } from "./helpers";

describe("buildGoalInputFiles", () => {
  test("maps goal clips to numbered input files", () => {
    const goals: Pick<VeoHighlight, "videos">[] = [
      {
        videos: [{ url: "https://c.veocdn.com/goal1.mp4" } as VeoHighlight["videos"][number]],
      },
      {
        videos: [{ url: "https://c.veocdn.com/goal2.mp4" } as VeoHighlight["videos"][number]],
      },
    ];

    expect(buildGoalInputFiles(goals)).toEqual({
      "goal1.mp4": "https://c.veocdn.com/goal1.mp4",
      "goal2.mp4": "https://c.veocdn.com/goal2.mp4",
    });
  });
});

describe("buildVgfFfmpegCommand", () => {
  test("uses a single-input transcode command for one goal", () => {
    const command = buildVgfFfmpegCommand({
      "goal1.mp4": "https://c.veocdn.com/goal1.mp4",
    });

    expect(command.outputFiles).toEqual([VGF_OUTPUT_FILENAME]);
    expect(command.ffmpegCommands[0]).toContain("{{goal1.mp4}}");
    expect(command.ffmpegCommands[0]).not.toContain("concat=");
  });

  test("uses concat filter for multiple goals", () => {
    const command = buildVgfFfmpegCommand({
      "goal1.mp4": "https://c.veocdn.com/goal1.mp4",
      "goal2.mp4": "https://c.veocdn.com/goal2.mp4",
      "goal3.mp4": "https://c.veocdn.com/goal3.mp4",
    });

    expect(command.ffmpegCommands[0]).toContain("concat=n=3:v=1:a=1");
    expect(command.ffmpegCommands[0]).toContain("-i {{goal1.mp4}}");
    expect(command.ffmpegCommands[0]).toContain("-i {{goal3.mp4}}");
  });
});

describe("buildVgfWebhookUrl", () => {
  test("builds a webhook URL with the Convex job id", () => {
    expect(
      buildVgfWebhookUrl(
        "https://fine-wolf-59.eu-west-1.convex.site",
        "jd7abc123",
      ),
    ).toBe(
      "https://fine-wolf-59.eu-west-1.convex.site/webhooks/vgffmpeg?jobId=jd7abc123",
    );
  });
});

describe("normalizeVgfJobPayload", () => {
  test("accepts wrapped webhook payloads", () => {
    const normalized = normalizeVgfJobPayload({
      data: {
        id: "vgf-123",
        status: "succeeded",
        output_files: {
          [VGF_OUTPUT_FILENAME]: "https://storage.example.com/goals.mp4",
        },
        error_message: "",
        total_output_bytes: 45_000_000,
      },
    });

    expect(normalized).toEqual({
      id: "vgf-123",
      status: "succeeded",
      outputFiles: {
        [VGF_OUTPUT_FILENAME]: "https://storage.example.com/goals.mp4",
      },
      errorMessage: "",
      totalOutputBytes: 45_000_000,
    });
  });

  test("extracts the goals output URL", () => {
    const normalized = normalizeVgfJobPayload({
      data: {
        id: "vgf-123",
        status: "succeeded",
        output_files: {
          [VGF_OUTPUT_FILENAME]: "https://storage.example.com/goals.mp4",
        },
      },
    });

    expect(getVgfOutputFileUrl(normalized!)).toBe(
      "https://storage.example.com/goals.mp4",
    );
  });
});

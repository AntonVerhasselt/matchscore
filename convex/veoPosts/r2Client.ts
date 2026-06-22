import { R2 } from "@convex-dev/r2";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const goalHighlightsR2 = new R2(components.r2);

export const GOAL_HIGHLIGHT_R2_KEY_PREFIX = "goal-highlights";

/** Signed URL lifetime for playback/download (max 7 days per R2 component). */
export const GOAL_HIGHLIGHT_URL_EXPIRES_SECONDS = 60 * 60 * 24;

export function goalHighlightObjectKey(jobId: Id<"veoPostJobs">): string {
  return `${GOAL_HIGHLIGHT_R2_KEY_PREFIX}/${jobId}.mp4`;
}

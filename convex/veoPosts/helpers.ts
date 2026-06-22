import {
  VeoPostValidationError,
  veoPostErrorData,
  type VeoPostErrorData,
} from "../../lib/goal-highlights/errors";

export { VeoPostValidationError, veoPostErrorData, type VeoPostErrorData };

export const VEO_MATCH_SLUG_RE =
  /(?:https?:\/\/)?(?:app\.)?veo\.co\/matches\/([^/?#]+)/i;

export const MAX_GOALS_PER_JOB = 15;

const NON_GOAL_SLUGS = new Set(["shot-on-goal"]);

const VEO_API = "https://app.veo.co/api/app/matches";

const VEO_FETCH_TIMEOUT_MS = 30_000;

const veoHeaders = {
  accept: "*/*",
  "veo-agent": "veo:svc:web-app",
  "veo-app-id": "hazard",
};

export type VeoHighlightTag = {
  name: string;
  slug: string;
  origin: string;
  custom: boolean;
};

export type VeoHighlightVideo = {
  url: string;
  width: number;
  height: number;
  mime_type: string;
  bit_rate: number | null;
  created: string;
};

export type VeoHighlight = {
  id: string;
  start: number;
  duration: number;
  tags: VeoHighlightTag[];
  videos: VeoHighlightVideo[];
  is_ai_generated?: boolean;
  should_render?: boolean;
  comment: string | null;
};

export type VeoMatchRaw = {
  slug: string;
  title: string;
  privacy: string;
  is_accessible: boolean;
  club?: { title?: string };
  opponent_club_name?: string;
  info?: {
    stats?: {
      score_aggregated?: {
        own?: number;
        opponent?: number;
      };
    };
  };
};

export type VeoMatchSummary = {
  slug: string;
  title: string;
  privacy: string;
  isAccessible: boolean;
  clubName: string | null;
  opponentName: string | null;
  scoreOwn: number | null;
  scoreOpponent: number | null;
};

export type VeoPostJobDedupeRow<TId extends string = string> = {
  _id: TId;
  status: "pending" | "fetching" | "processing" | "ready" | "failed";
  outputR2Key?: string;
  expiresAt?: number;
  createdAt: number;
};

export type DedupeDecision<TId extends string = string> =
  | { action: "open"; jobId: TId; reopenCached: boolean }
  | { action: "create" };

export class VeoApiError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "not_public"
      | "fetch_failed"
      | "invalid_response",
  ) {
    super(message);
    this.name = "VeoApiError";
  }
}

export function parseVeoMatchSlug(veoUrl: string): string | null {
  const match = veoUrl.trim().match(VEO_MATCH_SLUG_RE);
  return match?.[1] ?? null;
}

export function isGoalHighlightTag(slug: string): boolean {
  if (NON_GOAL_SLUGS.has(slug)) {
    return false;
  }
  if (slug === "goal") {
    return true;
  }
  if (slug.endsWith("-goal")) {
    return true;
  }
  return false;
}

export function highlightHasGoalTag(highlight: VeoHighlight): boolean {
  return highlight.tags?.some((tag) => isGoalHighlightTag(tag.slug)) ?? false;
}

export function filterGoalHighlights(highlights: VeoHighlight[]): VeoHighlight[] {
  return highlights
    .filter(highlightHasGoalTag)
    .filter((highlight) => highlight.should_render !== false)
    .filter((highlight) => Boolean(highlight.videos?.[0]?.url))
    .sort((a, b) => a.start - b.start);
}

export function mapVeoMatchSummary(raw: VeoMatchRaw): VeoMatchSummary {
  const score = raw.info?.stats?.score_aggregated;
  return {
    slug: raw.slug,
    title: raw.title,
    privacy: raw.privacy,
    isAccessible: raw.is_accessible,
    clubName: raw.club?.title ?? null,
    opponentName: raw.opponent_club_name ?? null,
    scoreOwn: score?.own ?? null,
    scoreOpponent: score?.opponent ?? null,
  };
}

export function buildScoreMismatchWarning(
  match: VeoMatchSummary,
  goalCount: number,
): string | null {
  const { scoreOwn, scoreOpponent } = match;
  if (scoreOwn === null || scoreOpponent === null) {
    return null;
  }

  const expectedGoals = scoreOwn + scoreOpponent;
  if (expectedGoals === goalCount) {
    return null;
  }

  return `Veo reports ${expectedGoals} goals in the scoreline but ${goalCount} goal clips were found. The compilation includes all detected goal clips.`;
}

export function assertMatchIsPublic(match: VeoMatchSummary): void {
  if (match.privacy !== "public" || !match.isAccessible) {
    throw new VeoApiError(
      "This match is not public or was not found",
      "not_public",
    );
  }
}

export type ValidatedVeoCompilation = {
  match: VeoMatchSummary;
  goals: VeoHighlight[];
  warningMessage: string | null;
};

export async function validateVeoMatchForCompilation(
  slug: string,
): Promise<ValidatedVeoCompilation> {
  const match = await fetchVeoMatch(slug);
  assertMatchIsPublic(match);

  const highlights = await fetchVeoHighlights(slug);
  const goals = filterGoalHighlights(highlights);

  if (goals.length === 0) {
    throw new VeoPostValidationError("no_goals");
  }

  if (goals.length > MAX_GOALS_PER_JOB) {
    throw new VeoPostValidationError("too_many_goals", MAX_GOALS_PER_JOB);
  }

  const missingClip = goals.find((goal) => !goal.videos[0]?.url);
  if (missingClip) {
    throw new VeoPostValidationError("clip_not_ready");
  }

  return {
    match,
    goals,
    warningMessage: buildScoreMismatchWarning(match, goals.length),
  };
}

export function resolveExistingJob<TId extends string>(
  jobs: VeoPostJobDedupeRow<TId>[],
  now: number,
): DedupeDecision<TId> {
  const sorted = [...jobs].sort((a, b) => b.createdAt - a.createdAt);

  for (const job of sorted) {
    if (
      job.status === "pending" ||
      job.status === "fetching" ||
      job.status === "processing"
    ) {
      return { action: "open", jobId: job._id, reopenCached: false };
    }
  }

  for (const job of sorted) {
    if (
      job.status === "ready" &&
      job.outputR2Key &&
      job.expiresAt &&
      job.expiresAt > now
    ) {
      return { action: "open", jobId: job._id, reopenCached: true };
    }
  }

  for (const job of sorted) {
    if (job.status === "ready" || job.status === "failed") {
      return { action: "open", jobId: job._id, reopenCached: false };
    }
  }

  return { action: "create" };
}

function mapVeoHttpError(status: number): VeoApiError {
  if (status === 404) {
    return new VeoApiError(
      "This match is not public or was not found",
      "not_found",
    );
  }
  if (status === 403) {
    return new VeoApiError(
      "This match is not public or was not found",
      "not_public",
    );
  }
  return new VeoApiError(
    `Veo request failed (${status})`,
    "fetch_failed",
  );
}

async function fetchVeo(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VEO_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: veoHeaders,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new VeoApiError("Veo request timed out", "fetch_failed");
    }
    throw new VeoApiError("Couldn't reach Veo", "fetch_failed");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchVeoMatch(slug: string): Promise<VeoMatchSummary> {
  const response = await fetchVeo(`${VEO_API}/${slug}/`);

  if (!response.ok) {
    throw mapVeoHttpError(response.status);
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== "object") {
    throw new VeoApiError("Unexpected Veo match response", "invalid_response");
  }

  const raw = data as VeoMatchRaw;
  if (!raw.slug || !raw.title) {
    throw new VeoApiError("Unexpected Veo match response", "invalid_response");
  }

  return mapVeoMatchSummary(raw);
}

export async function fetchVeoHighlights(slug: string): Promise<VeoHighlight[]> {
  const params = new URLSearchParams();
  for (const field of [
    "id",
    "start",
    "tags",
    "videos",
    "duration",
    "should_render",
    "is_ai_generated",
    "comment",
  ]) {
    params.append("fields", field);
  }
  params.set("include_ai", "true");

  const response = await fetchVeo(
    `${VEO_API}/${slug}/highlights/?${params.toString()}`,
  );

  if (!response.ok) {
    throw mapVeoHttpError(response.status);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new VeoApiError(
      "Unexpected Veo highlights response",
      "invalid_response",
    );
  }

  return data as VeoHighlight[];
}

export function mapVeoFailureToErrorData(error: unknown): VeoPostErrorData {
  if (error instanceof VeoPostValidationError) {
    return veoPostErrorData(error.code, { maxGoals: error.maxGoals });
  }

  if (error instanceof VeoApiError) {
    if (error.code === "not_found" || error.code === "not_public") {
      return veoPostErrorData("not_public");
    }
    if (error.code === "fetch_failed") {
      return veoPostErrorData("fetch_failed");
    }
  }

  return veoPostErrorData("unexpected");
}

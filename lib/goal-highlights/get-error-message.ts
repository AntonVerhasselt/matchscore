import { ConvexError } from "convex/values";
import {
  VEO_POST_ERROR_CODES,
  type VeoPostErrorData,
} from "@/lib/goal-highlights/errors";

type GoalHighlightsTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function getGoalHighlightsErrorMessage(
  error: unknown,
  translate: GoalHighlightsTranslator,
): string {
  const data = extractVeoPostErrorData(error);
  if (data) {
    return translateVeoPostErrorData(data, translate);
  }

  return translate("generateFailed");
}

function extractVeoPostErrorData(error: unknown): VeoPostErrorData | undefined {
  if (error instanceof ConvexError) {
    return normalizeVeoPostErrorData(error.data);
  }

  if (error && typeof error === "object" && "data" in error) {
    return normalizeVeoPostErrorData((error as { data: unknown }).data);
  }

  return undefined;
}

function normalizeVeoPostErrorData(data: unknown): VeoPostErrorData | undefined {
  if (!data || typeof data !== "object" || !("code" in data)) {
    return undefined;
  }

  const code = (data as { code: unknown }).code;
  if (
    typeof code !== "string" ||
    !(VEO_POST_ERROR_CODES as readonly string[]).includes(code)
  ) {
    return undefined;
  }

  return data as VeoPostErrorData;
}

function translateVeoPostErrorData(
  data: VeoPostErrorData | undefined,
  translate: GoalHighlightsTranslator,
): string {
  switch (data?.code) {
    case "invalid_url":
      return translate("errors.invalidUrl");
    case "not_public":
      return translate("errors.notPublic");
    case "no_goals":
      return translate("errors.noGoals");
    case "too_many_goals":
      return translate("errors.tooManyGoals", {
        max: data.maxGoals ?? 15,
      });
    case "clip_not_ready":
      return translate("errors.clipNotReady");
    case "fetch_failed":
      return translate("errors.fetchFailed");
    case "unexpected":
      return translate("errors.unexpected");
    default:
      return translate("generateFailed");
  }
}

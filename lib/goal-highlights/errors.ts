export const VEO_POST_ERROR_CODES = [
  "invalid_url",
  "not_public",
  "no_goals",
  "too_many_goals",
  "clip_not_ready",
  "fetch_failed",
  "unexpected",
  "feature_locked",
] as const;

export type VeoPostErrorCode = (typeof VEO_POST_ERROR_CODES)[number];

export type FeatureBlockReason =
  | "upgrade_required"
  | "subscription_inactive";

export type VeoPostErrorData = {
  code: VeoPostErrorCode;
  maxGoals?: number;
  blockReason?: FeatureBlockReason;
};

export type FeatureLockedErrorData = {
  code: "feature_locked";
  blockReason: FeatureBlockReason;
};

export function featureLockedErrorData(
  blockReason: FeatureBlockReason,
): FeatureLockedErrorData {
  return { code: "feature_locked", blockReason };
}

export function veoPostErrorData(
  code: VeoPostErrorCode,
  extras?: Pick<VeoPostErrorData, "maxGoals" | "blockReason">,
): VeoPostErrorData {
  return { code, ...extras };
}

export class VeoPostValidationError extends Error {
  readonly name = "VeoPostValidationError";

  constructor(
    readonly code: VeoPostErrorCode,
    readonly maxGoals?: number,
  ) {
    super(code);
  }
}

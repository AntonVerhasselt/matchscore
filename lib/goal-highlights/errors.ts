export const VEO_POST_ERROR_CODES = [
  "invalid_url",
  "not_public",
  "no_goals",
  "too_many_goals",
  "clip_not_ready",
  "fetch_failed",
  "unexpected",
] as const;

export type VeoPostErrorCode = (typeof VEO_POST_ERROR_CODES)[number];

export type VeoPostErrorData = {
  code: VeoPostErrorCode;
  maxGoals?: number;
};

export function veoPostErrorData(
  code: VeoPostErrorCode,
  extras?: Pick<VeoPostErrorData, "maxGoals">,
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

export const ALLOWED_COMPETITION_PATHS = [
  "/competities/2025-2026/antwerpen/mannen/2a/",
  "/competities/2025-2026/antwerpen/mannen/4a/",
] as const;

const ALLOWED_PATH_SET = new Set<string>(ALLOWED_COMPETITION_PATHS);

/**
 * Normalizes competition paths to a canonical form with a trailing slash.
 */
export function normalizeCompetitionPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

export function isCompetitionPathAllowed(path: string): boolean {
  return ALLOWED_PATH_SET.has(normalizeCompetitionPath(path));
}

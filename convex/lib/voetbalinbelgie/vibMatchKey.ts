/** Canonical key format used since June 2026. */
export function buildVibMatchKey(
  sourceCompetitionId: number,
  date: string,
  home: string,
  away: string,
): string {
  return JSON.stringify([sourceCompetitionId, date, home, away]);
}

/** Legacy colon-separated key format — kept for migration lookups only. */
export function buildLegacyVibMatchKey(
  sourceCompetitionId: number,
  date: string,
  home: string,
  away: string,
): string {
  return `${sourceCompetitionId}:${date}:${home}:${away}`;
}

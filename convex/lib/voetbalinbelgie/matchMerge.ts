import type { CompetitionMatchRow } from "./types";
import { buildVibMatchKey } from "./vibMatchKey";

/**
 * A match is final when both goal counts are present (played, forfeit, etc.).
 */
export function isFinalCompetitionMatch(row: CompetitionMatchRow): boolean {
  return typeof row.homeGoals === "number" && typeof row.awayGoals === "number";
}

/**
 * Merges results and program rows by vibMatchKey.
 * Program rows win until a final scored result exists for the same key.
 */
export function mergeCompetitionMatches(
  sourceCompetitionId: number,
  results: CompetitionMatchRow[],
  program: CompetitionMatchRow[],
): CompetitionMatchRow[] {
  const byKey = new Map<string, CompetitionMatchRow>();

  for (const row of program) {
    const key = buildVibMatchKey(
      sourceCompetitionId,
      row.date,
      row.home,
      row.away,
    );
    byKey.set(key, row);
  }

  for (const row of results) {
    const key = buildVibMatchKey(
      sourceCompetitionId,
      row.date,
      row.home,
      row.away,
    );
    if (isFinalCompetitionMatch(row)) {
      byKey.set(key, row);
      continue;
    }

    if (!byKey.has(key)) {
      byKey.set(key, row);
    }
  }

  return [...byKey.values()];
}

import type { ParsedCompetitionDto } from "./types";

/**
 * Collects every team name that sync must resolve from a competition payload.
 */
export function collectRequiredTeamNames(dto: ParsedCompetitionDto): string[] {
  const names = new Set<string>();

  for (const row of dto.leaguetable) {
    names.add(row.name);
  }

  for (const row of [...dto.results, ...dto.program]) {
    names.add(row.home);
    names.add(row.away);
  }

  return [...names];
}

export type FootballTeamUpsertKey =
  | { kind: "stamnummer_and_competition"; stamnummer: string; sourceCompetitionId: number }
  | { kind: "stamnummer_and_name"; stamnummer: string; name: string }
  | { kind: "slug_path_and_name"; slugPath: string; name: string };

/**
 * Picks the most specific upsert key for import idempotency.
 * Prefer (stamnummer, sourceCompetitionId) when both are known.
 */
export function getFootballTeamUpsertKey(args: {
  stamnummer?: string;
  sourceCompetitionId?: number;
  slugPath?: string;
  name: string;
}): FootballTeamUpsertKey {
  if (args.stamnummer && args.sourceCompetitionId !== undefined) {
    return {
      kind: "stamnummer_and_competition",
      stamnummer: args.stamnummer,
      sourceCompetitionId: args.sourceCompetitionId,
    };
  }

  if (args.stamnummer) {
    return {
      kind: "stamnummer_and_name",
      stamnummer: args.stamnummer,
      name: args.name,
    };
  }

  if (args.slugPath) {
    return {
      kind: "slug_path_and_name",
      slugPath: args.slugPath,
      name: args.name,
    };
  }

  throw new Error("Cannot derive football team upsert key without identifiers");
}

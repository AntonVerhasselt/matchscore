import type { Id } from "../../_generated/dataModel";

/** Stable identity for a match within a competition, independent of vibMatchKey format. */
export function buildLogicalMatchKey(args: {
  competitionId: Id<"competitions">;
  kickoffAt: number;
  homeTeamId: Id<"footballTeams">;
  awayTeamId: Id<"footballTeams">;
}): string {
  return `${args.competitionId}|${args.kickoffAt}|${args.homeTeamId}|${args.awayTeamId}`;
}

/** Identity by competition, kickoff, and VIB team names (handles duplicate team rows). */
export function buildSemanticMatchKey(args: {
  competitionId: Id<"competitions">;
  kickoffAt: number;
  homeVibTeamName: string;
  awayVibTeamName: string;
}): string {
  const teams = [args.homeVibTeamName, args.awayVibTeamName].sort();
  return `${args.competitionId}|${args.kickoffAt}|${teams[0]}|${teams[1]}`;
}

export type MatchLike = {
  _id: Id<"matches">;
  competitionId: Id<"competitions">;
  vibMatchKey: string;
  kickoffAt: number;
  homeTeamId: Id<"footballTeams">;
  awayTeamId: Id<"footballTeams">;
  updatedAt: number;
};

/** Prefer canonical JSON vibMatchKey, then newest updatedAt. */
export function pickCanonicalMatch<T extends MatchLike>(matches: T[]): T {
  if (matches.length === 0) {
    throw new Error("pickCanonicalMatch requires at least one match");
  }

  return [...matches].sort((a, b) => {
    const aCanonical = a.vibMatchKey.startsWith("[") ? 1 : 0;
    const bCanonical = b.vibMatchKey.startsWith("[") ? 1 : 0;
    if (aCanonical !== bCanonical) {
      return bCanonical - aCanonical;
    }
    return b.updatedAt - a.updatedAt;
  })[0]!;
}

export function groupMatchesByLogicalKey<T extends MatchLike>(
  matches: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const match of matches) {
    const key = buildLogicalMatchKey(match);
    const group = groups.get(key) ?? [];
    group.push(match);
    groups.set(key, group);
  }
  return groups;
}

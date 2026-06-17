import type { AutomationType } from "@/lib/template-scene";

export type MatchForSampleSelection = {
  kickoffAt: number;
  status: string;
  homeGoals?: number;
  awayGoals?: number;
};

function isPlayedMatch(match: MatchForSampleSelection): boolean {
  return (
    typeof match.homeGoals === "number" && typeof match.awayGoals === "number"
  );
}

function sortByKickoffAsc<T extends MatchForSampleSelection>(matches: T[]): T[] {
  return [...matches].sort((a, b) => a.kickoffAt - b.kickoffAt);
}

function sortByKickoffDesc<T extends MatchForSampleSelection>(matches: T[]): T[] {
  return [...matches].sort((a, b) => b.kickoffAt - a.kickoffAt);
}

export function selectSampleMatch<T extends MatchForSampleSelection>(
  matches: T[],
  automationType: AutomationType,
  now: number,
): T | null {
  if (matches.length === 0) {
    return null;
  }

  if (automationType === "match_result") {
    const played = sortByKickoffDesc(matches.filter(isPlayedMatch));
    return played[0] ?? null;
  }

  const future = sortByKickoffAsc(matches.filter((match) => match.kickoffAt >= now));
  if (future.length > 0) {
    return future[0] ?? null;
  }

  const past = sortByKickoffDesc(matches.filter((match) => match.kickoffAt < now));
  return past[0] ?? null;
}

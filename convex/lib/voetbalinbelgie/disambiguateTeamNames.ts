import type { ParsedClubTeam } from "./types";

export type TeamNameDisambiguationInput = {
  teamName: string;
  tabLabel?: string;
  competitionPath?: string;
};

export type TeamNameDisambiguationResult<T extends TeamNameDisambiguationInput> =
  T & {
    /** User-facing name (search, onboarding, org name). */
    displayName: string;
    /** Raw VoetbalInBelgië team name used for API/sync lookups. */
    vibTeamName: string;
  };

export function isWomensTeam(team: TeamNameDisambiguationInput): boolean {
  if (team.tabLabel && /vrouw/i.test(team.tabLabel)) {
    return true;
  }
  if (team.competitionPath && /\/vrouwen\//i.test(team.competitionPath)) {
    return true;
  }
  return false;
}

export function isReserveMaleTeam(team: TeamNameDisambiguationInput): boolean {
  if (team.tabLabel && /mannen\s+b/i.test(team.tabLabel)) {
    return true;
  }
  if (team.competitionPath && /\/mannen\/b(?:\/|$)/i.test(team.competitionPath)) {
    return true;
  }
  if (/\sB$/i.test(team.teamName.trim())) {
    return true;
  }
  return false;
}

export function suffixForDuplicateTeam(team: TeamNameDisambiguationInput): string {
  if (isWomensTeam(team)) {
    return " Dames";
  }
  if (isReserveMaleTeam(team)) {
    return " B";
  }
  if (team.tabLabel && team.tabLabel !== "Mannen") {
    return ` ${team.tabLabel}`;
  }
  return " 2";
}

export function tabLabelSortKey(tabLabel?: string): number {
  const order: Record<string, number> = {
    Mannen: 0,
    "Mannen B": 1,
    "Mannen C": 2,
    Vrouwen: 10,
    "Vrouwen B": 11,
  };

  if (!tabLabel) {
    return 50;
  }

  return order[tabLabel] ?? 50;
}

export function sortTeamsForDisambiguation<T extends TeamNameDisambiguationInput>(
  teams: T[],
): T[] {
  return [...teams].sort((left, right) => {
    const tabDiff = tabLabelSortKey(left.tabLabel) - tabLabelSortKey(right.tabLabel);
    if (tabDiff !== 0) {
      return tabDiff;
    }

    const leftPath = left.competitionPath ?? "";
    const rightPath = right.competitionPath ?? "";
    return leftPath.localeCompare(rightPath);
  });
}

/**
 * When multiple teams from the same club share a VoetbalInBelgië team name,
 * keep the first occurrence unchanged and suffix later duplicates.
 */
export function applyDisplayNameDisambiguation<T extends TeamNameDisambiguationInput>(
  teams: T[],
): Array<TeamNameDisambiguationResult<T>> {
  const orderedTeams = sortTeamsForDisambiguation(teams);
  const baseCounts = new Map<string, number>();

  for (const team of orderedTeams) {
    baseCounts.set(team.teamName, (baseCounts.get(team.teamName) ?? 0) + 1);
  }

  const duplicateBases = new Set(
    [...baseCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );

  const occurrenceIndex = new Map<string, number>();
  const usedDisplayNames = new Set<string>();

  return orderedTeams.map((team) => {
    const vibTeamName = team.teamName;
    const baseName = team.teamName;

    if (!duplicateBases.has(baseName)) {
      if (!usedDisplayNames.has(baseName)) {
        usedDisplayNames.add(baseName);
        return { ...team, displayName: baseName, vibTeamName };
      }

      let displayName = `${baseName}${suffixForDuplicateTeam(team)}`;
      let counter = 2;
      while (usedDisplayNames.has(displayName)) {
        displayName = `${baseName}${suffixForDuplicateTeam(team)} ${counter}`;
        counter += 1;
      }

      usedDisplayNames.add(displayName);
      return { ...team, displayName, vibTeamName };
    }

    const index = occurrenceIndex.get(baseName) ?? 0;
    occurrenceIndex.set(baseName, index + 1);

    if (index === 0) {
      usedDisplayNames.add(baseName);
      return { ...team, displayName: baseName, vibTeamName };
    }

    let displayName = `${baseName}${suffixForDuplicateTeam(team)}`;
    let counter = 2;
    while (usedDisplayNames.has(displayName)) {
      displayName = `${baseName}${suffixForDuplicateTeam(team)} ${counter}`;
      counter += 1;
    }

    usedDisplayNames.add(displayName);
    return { ...team, displayName, vibTeamName };
  });
}

export function applyDisplayNameDisambiguationToParsedTeams(
  teams: ParsedClubTeam[],
): Array<ParsedClubTeam & { displayName: string; vibTeamName: string }> {
  return applyDisplayNameDisambiguation(teams);
}

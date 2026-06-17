import { describe, expect, test } from "vitest";

import {
  isFinalCompetitionMatch,
  mergeCompetitionMatches,
} from "./matchMerge";
import type { CompetitionMatchRow } from "./types";

const SOURCE_COMPETITION_ID = 389;

const finalResult: CompetitionMatchRow = {
  status: "Gespeeld",
  date: "2026-04-26T15:00:00+02:00",
  home: "KSV Aartselaar",
  away: "KFC Putte",
  homeGoals: 2,
  awayGoals: 2,
  result: "2 - 2",
};

const scheduledProgram: CompetitionMatchRow = {
  status: "Gepland",
  date: "2026-04-26T15:00:00+02:00",
  home: "KSV Aartselaar",
  away: "KFC Putte",
};

describe("mergeCompetitionMatches", () => {
  test("prefers program until a final scored result exists", () => {
    const merged = mergeCompetitionMatches(
      SOURCE_COMPETITION_ID,
      [finalResult],
      [scheduledProgram],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe("Gespeeld");
    expect(merged[0]?.homeGoals).toBe(2);
  });

  test("keeps program row when results row has no final score", () => {
    const unfinishedResult: CompetitionMatchRow = {
      status: "Gespeeld",
      date: "2026-04-26T15:00:00+02:00",
      home: "KSV Aartselaar",
      away: "KFC Putte",
    };

    const merged = mergeCompetitionMatches(
      SOURCE_COMPETITION_ID,
      [unfinishedResult],
      [scheduledProgram],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe("Gepland");
  });

  test("isFinalCompetitionMatch requires both goal counts", () => {
    expect(isFinalCompetitionMatch(finalResult)).toBe(true);
    expect(isFinalCompetitionMatch(scheduledProgram)).toBe(false);
  });
});

import { describe, expect, test } from "vitest";

import {
  collectRequiredTeamNames,
  getFootballTeamUpsertKey,
} from "./teamNames";
import type { ParsedCompetitionDto } from "./types";

const dto: ParsedCompetitionDto = {
  meta: {
    id: 389,
    title: "2e provinciale A",
    district: "Antwerpen",
    season: "2025/2026",
  },
  relatedTeams: [],
  leaguetable: [
    {
      position: 1,
      name: "Team A",
      matches: 1,
      wins: 1,
      ties: 0,
      losses: 0,
      points: 3,
      goalsFor: 1,
      goalsAgainst: 0,
      pointsPunished: "0",
    },
  ],
  results: [
    {
      status: "Gespeeld",
      date: "2026-04-26T15:00:00+02:00",
      home: "Team A",
      away: "Team B",
      homeGoals: 1,
      awayGoals: 0,
    },
  ],
  program: [
    {
      status: "Gepland",
      date: "2026-05-10T15:00:00+02:00",
      home: "Team C",
      away: "Team D",
    },
  ],
};

describe("teamNames", () => {
  test("collectRequiredTeamNames unions leaguetable and match participants", () => {
    expect(collectRequiredTeamNames(dto).sort()).toEqual(
      ["Team A", "Team B", "Team C", "Team D"].sort(),
    );
  });

  test("getFootballTeamUpsertKey prefers stamnummer + competition", () => {
    expect(
      getFootballTeamUpsertKey({
        stamnummer: "7302",
        sourceCompetitionId: 389,
        name: "KSV Aartselaar",
        slugPath: "/clubs/a/aartselaar-ksv/",
      }),
    ).toEqual({
      kind: "stamnummer_and_competition",
      stamnummer: "7302",
      sourceCompetitionId: 389,
    });
  });

  test("getFootballTeamUpsertKey falls back to stamnummer + name", () => {
    expect(
      getFootballTeamUpsertKey({
        stamnummer: "9999",
        name: "Inactive FC",
      }),
    ).toEqual({
      kind: "stamnummer_and_name",
      stamnummer: "9999",
      name: "Inactive FC",
    });
  });
});

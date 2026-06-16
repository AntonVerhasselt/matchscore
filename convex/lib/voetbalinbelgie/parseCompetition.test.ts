import { describe, expect, test } from "vitest";

import { parseCompetitionJson } from "./parseCompetition";

const competitionFixture = {
  competition: {
    meta: {
      id: 389,
      title: "2e provinciale A, Antwerpen, Mannen",
      district: "Antwerpen",
      season: "2025/2026",
    },
    links: {
      related: [
        {
          name: "KSV Aartselaar",
          shirt: "t_48.png",
          logo: "aartselaar-ksv.webp",
          href: "https://api.voetbalinbelgie.be/clubs/a/aartselaar-ksv/",
        },
      ],
    },
    leaguetable: [
      {
        position: 8,
        name: "KSV Aartselaar",
        shirt: "t_48.png",
        logo: "aartselaar-ksv.webp",
        matches: 30,
        wins: 12,
        ties: 7,
        losses: 11,
        points: 43,
        goalsFor: 59,
        goalsAgainst: 42,
        pointsPunished: "0",
      },
    ],
    period1: [{ position: 1, name: "KSV Aartselaar" }],
    results: [
      {
        status: "Gespeeld",
        date: "2026-04-26T15:00:00+02:00",
        home: "KSV Aartselaar",
        away: "KFC Putte",
        homeGoals: 2,
        awayGoals: 2,
        result: "2 - 2",
      },
    ],
    program: [
      {
        status: "Gepland",
        date: "2026-05-10T15:00:00+02:00",
        home: "KFC Putte",
        away: "Puurs",
      },
    ],
  },
};

describe("parseCompetitionJson", () => {
  test("parses meta, standings, matches, and related teams", () => {
    const dto = parseCompetitionJson(competitionFixture);

    expect(dto.meta).toEqual({
      id: 389,
      title: "2e provinciale A, Antwerpen, Mannen",
      district: "Antwerpen",
      season: "2025/2026",
    });
    expect(dto.relatedTeams).toHaveLength(1);
    expect(dto.leaguetable).toHaveLength(1);
    expect(dto.results).toHaveLength(1);
    expect(dto.program).toHaveLength(1);
    expect(dto.results[0]?.homeGoals).toBe(2);
  });
});

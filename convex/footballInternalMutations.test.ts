/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import { assertAllCompetitionTeamsImported } from "./football/helpers";
import type { ParsedCompetitionDto } from "./lib/voetbalinbelgie/types";
import schema from "./schema";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts"))
    .filter(([path]) => !path.endsWith(".test.ts")),
);

const competitionDto: ParsedCompetitionDto = {
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
      name: "KSV Aartselaar",
      matches: 1,
      wins: 1,
      ties: 0,
      losses: 0,
      points: 3,
      goalsFor: 1,
      goalsAgainst: 0,
      pointsPunished: "0",
    },
    {
      position: 2,
      name: "KFC Putte",
      matches: 1,
      wins: 0,
      ties: 0,
      losses: 1,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 1,
      pointsPunished: "0",
    },
  ],
  results: [
    {
      status: "Gespeeld",
      date: "2026-04-26T15:00:00+02:00",
      home: "KSV Aartselaar",
      away: "KFC Putte",
      homeGoals: 1,
      awayGoals: 0,
    },
  ],
  program: [],
};

describe("football internalMutations", () => {
  test("upsertFootballTeam inserts and updates by stamnummer + competition", async () => {
    const t = convexTest(schema, modules);

    const firstId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KSV Aartselaar",
        vibTeamName: "KSV Aartselaar",
        stamnummer: "7302",
        sourceCompetitionId: 389,
        competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
        importSource: "club_page",
      },
    );

    const secondId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KSV Aartselaar",
        vibTeamName: "KSV Aartselaar",
        stamnummer: "7302",
        sourceCompetitionId: 389,
        competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
        tabLabel: "Mannen",
        importSource: "club_page",
      },
    );

    expect(secondId).toBe(firstId);

    const team = await t.run(async (ctx) => ctx.db.get(firstId));
    expect(team?.tabLabel).toBe("Mannen");
  });

  test("upsertFootballTeam supports multiple teams for one stamnummer", async () => {
    const t = convexTest(schema, modules);

    const firstTeamId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KSV Aartselaar",
        vibTeamName: "KSV Aartselaar",
        stamnummer: "7302",
        sourceCompetitionId: 389,
        importSource: "club_page",
      },
    );

    const reserveTeamId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KSV Aartselaar B",
        vibTeamName: "KSV Aartselaar B",
        stamnummer: "7302",
        sourceCompetitionId: 394,
        importSource: "club_page",
      },
    );

    expect(reserveTeamId).not.toBe(firstTeamId);
  });

  test("upsertFootballTeam falls back to stamnummer + name without competition", async () => {
    const t = convexTest(schema, modules);

    const teamId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "Inactive FC",
        vibTeamName: "Inactive FC",
        stamnummer: "9999",
        importSource: "club_page",
      },
    );

    const sameTeamId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "Inactive FC",
        vibTeamName: "Inactive FC",
        stamnummer: "9999",
        province: "Antwerpen",
        importSource: "club_page",
      },
    );

    expect(sameTeamId).toBe(teamId);
  });

  test("replaceCompetitionStandings and upsertMatch resolve imported teams", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: "KSV Aartselaar",
      vibTeamName: "KSV Aartselaar",
      stamnummer: "7302",
      sourceCompetitionId: 389,
      importSource: "club_page",
    });
    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: "KFC Putte",
      vibTeamName: "KFC Putte",
      stamnummer: "1234",
      sourceCompetitionId: 389,
      importSource: "club_page",
    });

    const competitionId = await t.mutation(
      internal.football.internalMutations.upsertCompetition,
      {
        sourceCompetitionId: 389,
        path: "/competities/2025-2026/antwerpen/mannen/2a/",
        title: "2e provinciale A",
        district: "Antwerpen",
        season: "2025/2026",
      },
    );

    const rowCount = await t.mutation(
      internal.football.internalMutations.replaceCompetitionStandings,
      {
        competitionId,
        sourceCompetitionId: 389,
        rows: competitionDto.leaguetable.map((row) => ({
          vibTeamName: row.name,
          position: row.position,
          matches: row.matches,
          wins: row.wins,
          ties: row.ties,
          losses: row.losses,
          points: row.points,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          pointsPunished: row.pointsPunished,
        })),
      },
    );

    expect(rowCount).toBe(2);

    const matchId = await t.mutation(
      internal.football.internalMutations.upsertMatch,
      {
        sourceCompetitionId: 389,
        competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
        vibMatchKey: "389:2026-04-26T15:00:00+02:00:KSV Aartselaar:KFC Putte",
        homeVibTeamName: "KSV Aartselaar",
        awayVibTeamName: "KFC Putte",
        kickoffAt: Date.parse("2026-04-26T15:00:00+02:00"),
        status: "Gespeeld",
        homeGoals: 1,
        awayGoals: 0,
        resultText: "1 - 0",
      },
    );

    const updatedMatchId = await t.mutation(
      internal.football.internalMutations.upsertMatch,
      {
        sourceCompetitionId: 389,
        competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
        vibMatchKey: "389:2026-04-26T15:00:00+02:00:KSV Aartselaar:KFC Putte",
        homeVibTeamName: "KSV Aartselaar",
        awayVibTeamName: "KFC Putte",
        kickoffAt: Date.parse("2026-04-26T15:00:00+02:00"),
        status: "Gespeeld",
        homeGoals: 2,
        awayGoals: 0,
        resultText: "2 - 0",
      },
    );

    expect(updatedMatchId).toBe(matchId);
  });

  test("upsertFootballTeam upgrades orphan rows without competition metadata", async () => {
    const t = convexTest(schema, modules);

    const orphanId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KFC Brasschaat",
        vibTeamName: "KFC Brasschaat",
        stamnummer: "228",
        slugPath: "/clubs/b/brasschaat-kfc/",
        importSource: "club_page",
      },
    );

    const linkedId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KFC Brasschaat",
        vibTeamName: "KFC Brasschaat",
        stamnummer: "228",
        slugPath: "/clubs/b/brasschaat-kfc/",
        sourceCompetitionId: 389,
        competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
        importSource: "club_page",
      },
    );

    expect(linkedId).toBe(orphanId);

    const team = await t.run(async (ctx) => ctx.db.get(linkedId));
    expect(team?.sourceCompetitionId).toBe(389);
  });
});

describe("assertAllCompetitionTeamsImported", () => {
  test("passes when all competition teams exist", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: "KSV Aartselaar",
      vibTeamName: "KSV Aartselaar",
      stamnummer: "7302",
      sourceCompetitionId: 389,
      importSource: "club_page",
    });
    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: "KFC Putte",
      vibTeamName: "KFC Putte",
      stamnummer: "1234",
      sourceCompetitionId: 389,
      importSource: "club_page",
    });

    await t.run(async (ctx) => {
      await expect(
        assertAllCompetitionTeamsImported(ctx, competitionDto),
      ).resolves.toBeUndefined();
    });
  });

  test("throws when a competition team is missing", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: "KSV Aartselaar",
      vibTeamName: "KSV Aartselaar",
      stamnummer: "7302",
      sourceCompetitionId: 389,
      importSource: "club_page",
    });

    await t.run(async (ctx) => {
      await expect(
        assertAllCompetitionTeamsImported(ctx, competitionDto),
      ).rejects.toThrow(/KFC Putte/);
    });
  });
});

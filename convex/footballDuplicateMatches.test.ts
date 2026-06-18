/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import { buildLegacyVibMatchKey, buildVibMatchKey } from "./lib/voetbalinbelgie/vibMatchKey";
import schema from "./schema";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts"),
  ),
);

const PATH_2A = "/competities/2025-2026/antwerpen/mannen/2a/";
const DATE = "2026-04-26T15:00:00+02:00";
const HOME = "KSV Aartselaar";
const AWAY = "KFC Putte";
const SOURCE_COMPETITION_ID = 389;

describe("duplicate match prevention", () => {
  test("upsertMatch merges legacy vibMatchKey rows into canonical key", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: HOME,
      vibTeamName: HOME,
      stamnummer: "7302",
      sourceCompetitionId: SOURCE_COMPETITION_ID,
      importSource: "club_page",
    });
    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: AWAY,
      vibTeamName: AWAY,
      stamnummer: "1234",
      sourceCompetitionId: SOURCE_COMPETITION_ID,
      importSource: "club_page",
    });

    await t.mutation(internal.football.internalMutations.upsertCompetition, {
      sourceCompetitionId: SOURCE_COMPETITION_ID,
      path: PATH_2A,
      title: "2e provinciale A",
      district: "Antwerpen",
      season: "2025/2026",
    });

    const legacyKey = buildLegacyVibMatchKey(
      SOURCE_COMPETITION_ID,
      DATE,
      HOME,
      AWAY,
    );
    const canonicalKey = buildVibMatchKey(
      SOURCE_COMPETITION_ID,
      DATE,
      HOME,
      AWAY,
    );

    const legacyMatchId = await t.mutation(
      internal.football.internalMutations.upsertMatch,
      {
        sourceCompetitionId: SOURCE_COMPETITION_ID,
        competitionPath: PATH_2A,
        vibMatchKey: legacyKey,
        homeVibTeamName: HOME,
        awayVibTeamName: AWAY,
        kickoffAt: Date.parse(DATE),
        status: "Gepland",
      },
    );

    const canonicalMatchId = await t.mutation(
      internal.football.internalMutations.upsertMatch,
      {
        sourceCompetitionId: SOURCE_COMPETITION_ID,
        competitionPath: PATH_2A,
        vibMatchKey: canonicalKey,
        homeVibTeamName: HOME,
        awayVibTeamName: AWAY,
        kickoffAt: Date.parse(DATE),
        status: "Gespeeld",
        homeGoals: 2,
        awayGoals: 0,
        resultText: "2 - 0",
      },
    );

    expect(canonicalMatchId).toBe(legacyMatchId);

    const matches = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(matches).toHaveLength(1);
    expect(matches[0]?.vibMatchKey).toBe(canonicalKey);
    expect(matches[0]?.status).toBe("Gespeeld");
  });

  test("dedupeDuplicateMatches removes legacy duplicate rows", async () => {
    const t = convexTest(schema, modules);

    const homeTeamId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: HOME,
        vibTeamName: HOME,
        stamnummer: "7302",
        sourceCompetitionId: SOURCE_COMPETITION_ID,
        importSource: "club_page",
      },
    );
    const awayTeamId = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: AWAY,
        vibTeamName: AWAY,
        stamnummer: "1234",
        sourceCompetitionId: SOURCE_COMPETITION_ID,
        importSource: "club_page",
      },
    );

    const competitionId = await t.mutation(
      internal.football.internalMutations.upsertCompetition,
      {
        sourceCompetitionId: SOURCE_COMPETITION_ID,
        path: PATH_2A,
        title: "2e provinciale A",
        district: "Antwerpen",
        season: "2025/2026",
      },
    );

    const kickoffAt = Date.parse(DATE);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("matches", {
        competitionId,
        vibMatchKey: buildLegacyVibMatchKey(
          SOURCE_COMPETITION_ID,
          DATE,
          HOME,
          AWAY,
        ),
        homeTeamId,
        awayTeamId,
        kickoffAt,
        status: "Gepland",
        updatedAt: now,
      });
      await ctx.db.insert("matches", {
        competitionId,
        vibMatchKey: buildVibMatchKey(
          SOURCE_COMPETITION_ID,
          DATE,
          HOME,
          AWAY,
        ),
        homeTeamId,
        awayTeamId,
        kickoffAt,
        status: "Gespeeld",
        homeGoals: 1,
        awayGoals: 0,
        updatedAt: now - 1,
      });
    });

    const result = await t.mutation(
      internal.football.internalMutations.dedupeDuplicateMatches,
      { competitionId },
    );

    expect(result.removed).toBe(1);

    const matches = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(matches).toHaveLength(1);
    expect(matches[0]?.vibMatchKey).toBe(
      buildVibMatchKey(SOURCE_COMPETITION_ID, DATE, HOME, AWAY),
    );
    expect(matches[0]?.status).toBe("Gespeeld");
    expect(matches[0]?.homeGoals).toBe(1);
    expect(matches[0]?.awayGoals).toBe(0);
  });
});

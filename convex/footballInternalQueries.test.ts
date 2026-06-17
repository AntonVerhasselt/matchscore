/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts"),
  ),
);

const PATH_2A = "/competities/2025-2026/antwerpen/mannen/2a/";
const PATH_4A = "/competities/2025-2026/antwerpen/mannen/4a/";

describe("football internalQueries", () => {
  test("listLinkedCompetitionPaths returns distinct allowlisted paths from orgs", async () => {
    const t = convexTest(schema, modules);

    const team2a = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KSV Aartselaar",
        vibTeamName: "KSV Aartselaar",
        stamnummer: "7302",
        sourceCompetitionId: 389,
        competitionPath: PATH_2A,
        importSource: "club_page",
      },
    );

    const team4a = await t.mutation(
      internal.football.internalMutations.upsertFootballTeam,
      {
        name: "KSV Aartselaar B",
        vibTeamName: "KSV Aartselaar B",
        stamnummer: "7302",
        sourceCompetitionId: 394,
        competitionPath: PATH_4A,
        importSource: "club_page",
      },
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        name: "KSV Aartselaar",
        slug: "ksv-aartselaar",
        footballTeamId: team2a,
        createdByUserId: "user-1",
        createdAt: Date.now(),
      });
      await ctx.db.insert("organizations", {
        name: "KSV Aartselaar B",
        slug: "ksv-aartselaar-b",
        footballTeamId: team4a,
        createdByUserId: "user-2",
        createdAt: Date.now(),
      });
    });

    const paths = await t.query(
      internal.football.internalQueries.listLinkedCompetitionPaths,
      {},
    );

    expect(paths.sort()).toEqual([PATH_2A, PATH_4A].sort());
  });

  test("validateCompetitionTeamsImported reports missing teams", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
      name: "KSV Aartselaar",
      vibTeamName: "KSV Aartselaar",
      stamnummer: "7302",
      sourceCompetitionId: 389,
      importSource: "club_page",
    });

    const result = await t.query(
      internal.football.internalQueries.validateCompetitionTeamsImported,
      {
        sourceCompetitionId: 389,
        teamNames: ["KSV Aartselaar", "KFC Putte"],
      },
    );

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["KFC Putte"]);
  });

  test("getCompetitionSyncState returns null when competition row is missing", async () => {
    const t = convexTest(schema, modules);

    const state = await t.query(
      internal.football.internalQueries.getCompetitionSyncState,
      { path: PATH_2A },
    );

    expect(state).toBeNull();
  });

  test("getCompetitionSyncState returns lastSyncedAt when competition exists", async () => {
    const t = convexTest(schema, modules);
    const syncedAt = 1_700_000_000_000;

    const competitionId = await t.mutation(
      internal.football.internalMutations.upsertCompetition,
      {
        sourceCompetitionId: 389,
        path: PATH_2A,
        title: "2e provinciale A",
        district: "Antwerpen",
        season: "2025/2026",
      },
    );

    await t.mutation(
      internal.football.internalMutations.patchCompetitionSyncStatus,
      {
        competitionId,
        lastSyncedAt: syncedAt,
        lastSyncError: null,
      },
    );

    const state = await t.query(
      internal.football.internalQueries.getCompetitionSyncState,
      { path: PATH_2A },
    );

    expect(state?.lastSyncedAt).toBe(syncedAt);
  });
});

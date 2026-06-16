/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts"),
  ),
);

const PATH_2A = "/competities/2025-2026/antwerpen/mannen/2a/";

const competitionApiPayload = {
  competition: {
    meta: {
      id: 389,
      title: "2e provinciale A",
      district: "Antwerpen",
      season: "2025/2026",
    },
    links: { related: [] },
    leaguetable: [
      {
        position: 1,
        name: "KSV Aartselaar",
        matches: 1,
        wins: 1,
        ties: 0,
        losses: 0,
        points: 3,
        goalsFor: 2,
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
        goalsAgainst: 2,
        pointsPunished: "0",
      },
    ],
    results: [
      {
        status: "Gespeeld",
        date: "2026-04-26T15:00:00+02:00",
        home: "KSV Aartselaar",
        away: "KFC Putte",
        homeGoals: 2,
        awayGoals: 0,
        result: "2 - 0",
      },
    ],
    program: [
      {
        status: "Gepland",
        date: "2026-06-20T15:00:00+02:00",
        home: "KSV Aartselaar",
        away: "KFC Putte",
      },
    ],
  },
};

function mockCompetitionFetch(payload: unknown = competitionApiPayload) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(payload),
    }),
  );
}

async function seedCompetitionTeams(t: ReturnType<typeof convexTest>) {
  await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
    name: "KSV Aartselaar",
    vibTeamName: "KSV Aartselaar",
    stamnummer: "7302",
    sourceCompetitionId: 389,
    competitionPath: PATH_2A,
    importSource: "club_page",
  });
  await t.mutation(internal.football.internalMutations.upsertFootballTeam, {
    name: "KFC Putte",
    vibTeamName: "KFC Putte",
    stamnummer: "1234",
    sourceCompetitionId: 389,
    importSource: "club_page",
  });
}

describe("syncCompetition", () => {
  beforeEach(() => {
    vi.stubEnv("VOETBALINBELGIE_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("skips non-allowlisted competition paths", async () => {
    const t = convexTest(schema, modules);

    const result = await t.action(internal.football.syncActions.syncCompetition, {
      path: "/competities/2025-2026/limburg/mannen/1/",
      force: true,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "not_allowlisted",
      path: "/competities/2025-2026/limburg/mannen/1/",
    });
  });

  test("skips fetch when inside TTL unless forced", async () => {
    const t = convexTest(schema, modules);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

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
        lastSyncedAt: Date.now(),
        lastSyncError: null,
      },
    );

    const result = await t.action(internal.football.syncActions.syncCompetition, {
      path: PATH_2A,
      force: false,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "ttl",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("syncs standings and matches without creating footballTeams rows", async () => {
    mockCompetitionFetch();
    const t = convexTest(schema, modules);
    await seedCompetitionTeams(t);

    const teamCountBefore = await t.run(async (ctx) => {
      const teams = await ctx.db.query("footballTeams").collect();
      return teams.length;
    });

    const result = await t.action(internal.football.syncActions.syncCompetition, {
      path: PATH_2A,
      force: true,
    });

    expect(result.status).toBe("synced");
    expect(result.matchCount).toBe(2);

    const teamCountAfter = await t.run(async (ctx) => {
      const teams = await ctx.db.query("footballTeams").collect();
      return teams.length;
    });
    expect(teamCountAfter).toBe(teamCountBefore);

    const syncState = await t.query(
      internal.football.internalQueries.getCompetitionSyncState,
      { path: PATH_2A },
    );
    expect(syncState?.lastSyncedAt).toBeTypeOf("number");

    const matches = await t.run(async (ctx) => ctx.db.query("matches").collect());
    expect(matches).toHaveLength(2);

    const standings = await t.run(async (ctx) =>
      ctx.db.query("competitionStandings").collect(),
    );
    expect(standings).toHaveLength(2);
  });

  test("records lastSyncError when imported teams are missing", async () => {
    mockCompetitionFetch();
    const t = convexTest(schema, modules);

    const result = await t.action(internal.football.syncActions.syncCompetition, {
      path: PATH_2A,
      force: true,
    });

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/Missing imported teams/);

    const syncState = await t.query(
      internal.football.internalQueries.getCompetitionSyncState,
      { path: PATH_2A },
    );
    expect(syncState?.lastSyncedAt).toBeUndefined();
  });

  test("syncLinkedCompetitions syncs paths linked through organizations", async () => {
    mockCompetitionFetch();
    const t = convexTest(schema, modules);
    await seedCompetitionTeams(t);

    const teamId = await t.run(async (ctx) => {
      const team = await ctx.db
        .query("footballTeams")
        .withIndex("by_competition_and_vibTeamName", (q) =>
          q.eq("sourceCompetitionId", 389).eq("vibTeamName", "KSV Aartselaar"),
        )
        .unique();
      return team!._id;
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organizations", {
        name: "KSV Aartselaar",
        slug: "ksv-aartselaar-sync-test",
        footballTeamId: teamId,
        createdByUserId: "user-sync",
        createdAt: Date.now(),
      });
    });

    const result = await t.action(
      internal.football.syncActions.syncLinkedCompetitions,
      {},
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.status).toBe("synced");
  });
});

/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "./_generated/api";
import { authComponent } from "./auth/instance";
import schema from "./schema";

const modules = Object.fromEntries(
  Object.entries(import.meta.glob("./**/*.ts")).filter(
    ([path]) => !path.endsWith(".test.ts"),
  ),
);

const PATH_2A = "/competities/2025-2026/antwerpen/mannen/2a/";
const PATH_4A = "/competities/2025-2026/antwerpen/mannen/4a/";

describe("updateOrganizationFootballTeam", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("updates linked team and organization name while preserving slug", async () => {
    const t = convexTest(schema, modules);

    vi.spyOn(authComponent, "getAuthUser").mockResolvedValue({
      _id: "user-1",
      email: "member@example.com",
      name: "Member",
    } as Awaited<ReturnType<typeof authComponent.getAuthUser>>);

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

    const organizationId = await t.run(async (ctx) => {
      const orgId = await ctx.db.insert("organizations", {
        name: "KSV Aartselaar",
        slug: "ksv-aartselaar-original-slug",
        footballTeamId: team2a,
        createdByUserId: "user-1",
        createdAt: Date.now(),
      });

      await ctx.db.insert("organizationMembers", {
        organizationId: orgId,
        userId: "user-1",
        email: "member@example.com",
        joinedAt: Date.now(),
      });

      return orgId;
    });

    await t.mutation(api.organizations.mutations.updateOrganizationFootballTeam, {
      footballTeamId: team4a,
    });

    const organization = await t.run(async (ctx) => ctx.db.get(organizationId));

    expect(organization?.footballTeamId).toBe(team4a);
    expect(organization?.name).toBe("KSV Aartselaar B");
    expect(organization?.slug).toBe("ksv-aartselaar-original-slug");
  });
});

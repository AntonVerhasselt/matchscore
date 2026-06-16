import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";

const SEED_TEAM = {
  name: "KSV Aartselaar",
  vibTeamName: "KSV Aartselaar",
  stamnummer: "7302",
  slugPath: "/clubs/a/aartselaar-ksv/",
  slug: "aartselaar-ksv",
  parentStamnummer: "7302",
  sourceCompetitionId: 389,
  competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
  tabLabel: "Mannen",
  website: "https://www.ksvaartselaar.com/",
  telephone: "03/887.94.68",
  address: {
    street: "Kleistraat 204",
    postalCode: "2630",
    city: "Aartselaar",
    region: "Antwerpen",
    country: "BE",
  },
  province: "Antwerpen",
  importSource: "club_page" as const,
};

function isDevelopmentDeployment(): boolean {
  const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
  const cloudUrl = process.env.CONVEX_CLOUD_URL ?? "";
  return (
    deployment.startsWith("dev:") ||
    deployment.includes(":dev") ||
    cloudUrl.includes("fine-wolf-59")
  );
}

/**
 * Dev-only: seed KSV Aartselaar for onboarding tests.
 * Run: pnpm seed:football-team
 */
export const seed = internalMutation({
  args: {},
  returns: v.object({
    footballTeamId: v.id("footballTeams"),
    created: v.boolean(),
    name: v.string(),
  }),
  handler: async (ctx) => {
    if (!isDevelopmentDeployment()) {
      throw new ConvexError("seed is blocked outside development deployments");
    }

    const existing = await ctx.db
      .query("footballTeams")
      .withIndex("by_stamnummer_and_sourceCompetitionId", (q) =>
        q
          .eq("stamnummer", SEED_TEAM.stamnummer)
          .eq("sourceCompetitionId", SEED_TEAM.sourceCompetitionId),
      )
      .unique();

    if (existing) {
      return {
        footballTeamId: existing._id,
        created: false,
        name: existing.name,
      };
    }

    const footballTeamId = await ctx.db.insert("footballTeams", {
      ...SEED_TEAM,
      importedAt: Date.now(),
    });

    return {
      footballTeamId,
      created: true,
      name: SEED_TEAM.name,
    };
  },
});

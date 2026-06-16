import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { resolveFootballTeamId } from "./helpers";

export const getLogoStorageIdBySourceUrl = internalQuery({
  args: {
    logoSourceUrl: v.string(),
  },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    const team = await ctx.db
      .query("footballTeams")
      .withIndex("by_logoSourceUrl", (q) =>
        q.eq("logoSourceUrl", args.logoSourceUrl),
      )
      .first();

    return team?.logoStorageId ?? null;
  },
});

export const countFootballTeams = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const teams = await ctx.db.query("footballTeams").collect();
    return teams.length;
  },
});

export const isTeamImportedForCompetition = internalQuery({
  args: {
    sourceCompetitionId: v.number(),
    vibTeamName: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const teamId = await resolveFootballTeamId(
      ctx,
      args.sourceCompetitionId,
      args.vibTeamName,
    );
    return teamId !== null;
  },
});

/** True when every team row for this club page has competition metadata when panels exist. */
export const isClubPageImportComplete = internalQuery({
  args: {
    slugPath: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const teams = await ctx.db
      .query("footballTeams")
      .filter((q) => q.eq(q.field("slugPath"), args.slugPath))
      .collect();

    if (teams.length === 0) {
      return false;
    }

    return teams.every((team) => team.sourceCompetitionId !== undefined);
  },
});

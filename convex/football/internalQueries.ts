import { v } from "convex/values";

import {
  isCompetitionPathAllowed,
  normalizeCompetitionPath,
} from "../lib/voetbalinbelgie/allowlist";
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
export const getCompetitionSyncState = internalQuery({
  args: {
    path: v.string(),
  },
  returns: v.union(
    v.object({
      competitionId: v.id("competitions"),
      lastSyncedAt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const path = normalizeCompetitionPath(args.path);
    const competition = await ctx.db
      .query("competitions")
      .withIndex("by_path", (q) => q.eq("path", path))
      .unique();

    if (!competition) {
      return null;
    }

    return {
      competitionId: competition._id,
      lastSyncedAt: competition.lastSyncedAt,
    };
  },
});

export const validateCompetitionTeamsImported = internalQuery({
  args: {
    sourceCompetitionId: v.number(),
    teamNames: v.array(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    missing: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const missing: string[] = [];

    for (const name of args.teamNames) {
      const teamId = await resolveFootballTeamId(
        ctx,
        args.sourceCompetitionId,
        name,
      );
      if (!teamId) {
        missing.push(name);
      }
    }

    return {
      ok: missing.length === 0,
      missing,
    };
  },
});

export const listLinkedCompetitionPaths = internalQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();
    const paths = new Set<string>();

    for (const organization of organizations) {
      const team = await ctx.db.get(organization.footballTeamId);
      if (!team?.competitionPath) {
        continue;
      }

      const path = normalizeCompetitionPath(team.competitionPath);
      if (isCompetitionPathAllowed(path)) {
        paths.add(path);
      }
    }

    return [...paths];
  },
});

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

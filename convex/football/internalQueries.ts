import { v } from "convex/values";

import {
  isCompetitionPathAllowed,
  normalizeCompetitionPath,
} from "../lib/voetbalinbelgie/allowlist";
import { groupMatchesByLogicalKey } from "../lib/voetbalinbelgie/matchIdentity";
import { internalQuery } from "../_generated/server";
import { automationTypeValidator } from "../automations/validators";
import { fetchTemplateRenderMatchForTeam } from "./templateRenderMatchHelpers";
import { templateMatchDtoValidator } from "./validators";
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
      lastSyncError: v.optional(v.string()),
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
      lastSyncError: competition.lastSyncError,
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
      .withIndex("by_slugPath", (q) => q.eq("slugPath", args.slugPath))
      .collect();

    if (teams.length === 0) {
      return false;
    }

    return teams.every((team) => team.sourceCompetitionId !== undefined);
  },
});

export const getTemplateRenderMatchForOrganization = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    automationType: automationTypeValidator,
    now: v.number(),
  },
  returns: v.union(templateMatchDtoValidator, v.null()),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      return null;
    }

    return await fetchTemplateRenderMatchForTeam(ctx, {
      footballTeamId: organization.footballTeamId,
      automationType: args.automationType,
      now: args.now,
    });
  },
});

export const inspectDuplicateMatches = internalQuery({
  args: {
    competitionId: v.optional(v.id("competitions")),
  },
  returns: v.object({
    totalMatches: v.number(),
    duplicateGroups: v.number(),
    duplicateRows: v.number(),
    samples: v.array(
      v.object({
        competitionId: v.id("competitions"),
        kickoffAt: v.number(),
        homeTeamId: v.id("footballTeams"),
        awayTeamId: v.id("footballTeams"),
        count: v.number(),
        vibMatchKeys: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const matches = args.competitionId
      ? await ctx.db
          .query("matches")
          .withIndex("by_competitionId_and_kickoffAt", (q) =>
            q.eq("competitionId", args.competitionId!),
          )
          .collect()
      : await ctx.db.query("matches").collect();

    const duplicateGroups = [...groupMatchesByLogicalKey(matches).values()].filter(
      (group) => group.length > 1,
    );

    return {
      totalMatches: matches.length,
      duplicateGroups: duplicateGroups.length,
      duplicateRows: duplicateGroups.reduce(
        (sum, group) => sum + group.length - 1,
        0,
      ),
      samples: duplicateGroups.slice(0, 10).map((group) => ({
        competitionId: group[0]!.competitionId,
        kickoffAt: group[0]!.kickoffAt,
        homeTeamId: group[0]!.homeTeamId,
        awayTeamId: group[0]!.awayTeamId,
        count: group.length,
        vibMatchKeys: group.map((match) => match.vibMatchKey),
      })),
    };
  },
});

export const inspectDuplicateFootballTeams = internalQuery({
  args: {},
  returns: v.object({
    duplicateTeamGroups: v.number(),
    duplicateTeamRows: v.number(),
    samples: v.array(
      v.object({
        sourceCompetitionId: v.number(),
        vibTeamName: v.string(),
        count: v.number(),
        teamIds: v.array(v.id("footballTeams")),
        names: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const teams = await ctx.db.query("footballTeams").collect();
    const groups = new Map<string, typeof teams>();

    for (const team of teams) {
      if (team.sourceCompetitionId === undefined) {
        continue;
      }

      const key = `${team.sourceCompetitionId}|${team.vibTeamName}`;
      const group = groups.get(key) ?? [];
      group.push(team);
      groups.set(key, group);
    }

    const duplicateGroups = [...groups.values()].filter(
      (group) => group.length > 1,
    );

    return {
      duplicateTeamGroups: duplicateGroups.length,
      duplicateTeamRows: duplicateGroups.reduce(
        (sum, group) => sum + group.length - 1,
        0,
      ),
      samples: duplicateGroups.slice(0, 10).map((group) => ({
        sourceCompetitionId: group[0]!.sourceCompetitionId!,
        vibTeamName: group[0]!.vibTeamName,
        count: group.length,
        teamIds: group.map((team) => team._id),
        names: group.map((team) => team.name),
      })),
    };
  },
});

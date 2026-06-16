import { ConvexError, v } from "convex/values";

import { isCompetitionPathAllowed } from "../lib/voetbalinbelgie/allowlist";
import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireCurrentMembership } from "../automations/helpers";
import {
  calendarAccessStatusValidator,
  competitionStandingRowValidator,
  footballTeamDetailValidator,
  footballTeamSummaryValidator,
  teamMatchSummaryValidator,
} from "./validators";

const MAX_RESULTS = 20;

async function toFootballTeamSummary(
  ctx: Pick<QueryCtx, "storage">,
  team: Doc<"footballTeams">,
) {
  const logoUrl = team.logoStorageId
    ? await ctx.storage.getUrl(team.logoStorageId)
    : null;

  return {
    _id: team._id,
    name: team.name,
    vibTeamName: team.vibTeamName,
    stamnummer: team.stamnummer,
    competitionPath: team.competitionPath,
    sourceCompetitionId: team.sourceCompetitionId,
    logoStorageId: team.logoStorageId,
    logoUrl,
  };
}

export const searchFootballTeams = query({
  args: {
    query: v.string(),
  },
  returns: v.array(footballTeamSummaryValidator),
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim().toLowerCase();
    if (normalizedQuery.length < 2) {
      return [];
    }

    const matches = [];
    for await (const team of ctx.db
      .query("footballTeams")
      .withIndex("by_name")) {
      if (team.name.toLowerCase().includes(normalizedQuery)) {
        matches.push(await toFootballTeamSummary(ctx, team));
        if (matches.length >= MAX_RESULTS) {
          break;
        }
      }
    }

    return matches;
  },
});

export const getFootballTeamForSelection = query({
  args: {
    footballTeamId: v.id("footballTeams"),
  },
  returns: v.union(footballTeamSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const team = await ctx.db.get(args.footballTeamId);
    if (!team) {
      return null;
    }

    return toFootballTeamSummary(ctx, team);
  },
});

export const getFootballTeam = query({
  args: {
    footballTeamId: v.id("footballTeams"),
  },
  returns: v.union(footballTeamDetailValidator, v.null()),
  handler: async (ctx, args) => {
    await requireCurrentMembership(ctx);

    const team = await ctx.db.get(args.footballTeamId);
    if (!team) {
      return null;
    }

    return {
      _id: team._id,
      name: team.name,
      vibTeamName: team.vibTeamName,
      stamnummer: team.stamnummer,
      slugPath: team.slugPath,
      competitionPath: team.competitionPath,
      sourceCompetitionId: team.sourceCompetitionId,
      tabLabel: team.tabLabel,
      website: team.website,
      telephone: team.telephone,
      address: team.address,
      province: team.province,
      logoStorageId: team.logoStorageId,
    };
  },
});

export const listTeamMatches = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(teamMatchSummaryValidator),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      throw new ConvexError("Organisation not found");
    }

    const teamId = organization.footballTeamId;
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const now = Date.now();
    const lookbackMs = 180 * 24 * 60 * 60 * 1000;
    const minKickoff = now - lookbackMs;

    const homeMatches = await ctx.db
      .query("matches")
      .withIndex("by_homeTeamId_and_kickoffAt", (q) =>
        q.eq("homeTeamId", teamId).gte("kickoffAt", minKickoff),
      )
      .collect();

    const awayMatches = await ctx.db
      .query("matches")
      .withIndex("by_awayTeamId_and_kickoffAt", (q) =>
        q.eq("awayTeamId", teamId).gte("kickoffAt", minKickoff),
      )
      .collect();

    const teamCache = new Map<
      string,
      { name: string; logoUrl: string | null }
    >();
    const getTeamInfo = async (id: typeof teamId) => {
      const key = id as string;
      if (teamCache.has(key)) {
        return teamCache.get(key)!;
      }
      const team = await ctx.db.get(id);
      const info = {
        name: team?.name ?? "Unknown team",
        logoUrl: team?.logoStorageId
          ? ((await ctx.storage.getUrl(team.logoStorageId)) ?? null)
          : null,
      };
      teamCache.set(key, info);
      return info;
    };

    const summaries = await Promise.all(
      [...homeMatches, ...awayMatches].map(async (match) => {
        const homeTeam = await getTeamInfo(match.homeTeamId);
        const awayTeam = await getTeamInfo(match.awayTeamId);
        const isHome = match.homeTeamId === teamId;
        const opponent = isHome ? awayTeam : homeTeam;
        const played =
          typeof match.homeGoals === "number" &&
          typeof match.awayGoals === "number";

        return {
          _id: match._id,
          kickoffAt: match.kickoffAt,
          status: match.status,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          homeTeamName: homeTeam.name,
          awayTeamName: awayTeam.name,
          opponentName: opponent.name,
          opponentLogoUrl: opponent.logoUrl,
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
          resultText: match.resultText,
          isHome,
          matchStatus: played ? ("played" as const) : ("upcoming" as const),
        };
      }),
    );

    summaries.sort((a, b) => a.kickoffAt - b.kickoffAt);
    return summaries.slice(0, limit);
  },
});

export const getCompetitionStandings = query({
  args: {},
  returns: v.array(competitionStandingRowValidator),
  handler: async (ctx) => {
    const { membership } = await requireCurrentMembership(ctx);
    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      throw new ConvexError("Organisation not found");
    }

    const team = await ctx.db.get(organization.footballTeamId);
    if (!team?.sourceCompetitionId) {
      return [];
    }

    const competition = await ctx.db
      .query("competitions")
      .withIndex("by_sourceCompetitionId", (q) =>
        q.eq("sourceCompetitionId", team.sourceCompetitionId!),
      )
      .unique();

    if (!competition) {
      return [];
    }

    const rows = await ctx.db
      .query("competitionStandings")
      .filter((q) => q.eq(q.field("competitionId"), competition._id))
      .collect();

    rows.sort((a, b) => a.position - b.position);

    return Promise.all(
      rows.map(async (row) => {
        const rowTeam = await ctx.db.get(row.teamId);
        return {
          teamId: row.teamId,
          teamName: rowTeam?.name ?? "Unknown team",
          position: row.position,
          matches: row.matches,
          wins: row.wins,
          ties: row.ties,
          losses: row.losses,
          points: row.points,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          pointsPunished: row.pointsPunished,
          shirt: row.shirt,
          vibLogoFile: row.vibLogoFile,
          logoStorageId: rowTeam?.logoStorageId,
        };
      }),
    );
  },
});

export const getCalendarAccessStatus = query({
  args: {},
  returns: calendarAccessStatusValidator,
  handler: async (ctx) => {
    const { membership } = await requireCurrentMembership(ctx);
    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      throw new ConvexError("Organisation not found");
    }

    const team = await ctx.db.get(organization.footballTeamId);
    if (!team?.competitionPath) {
      return {
        hasApiAccess: false,
        competitionPath: null,
        lastSyncedAt: null,
        lastSyncError: null,
        messageKey: "calendar_no_competition" as const,
      };
    }

    if (!isCompetitionPathAllowed(team.competitionPath)) {
      return {
        hasApiAccess: false,
        competitionPath: team.competitionPath,
        lastSyncedAt: null,
        lastSyncError: null,
        messageKey: "calendar_not_allowlisted" as const,
      };
    }

    const competition = await ctx.db
      .query("competitions")
      .withIndex("by_path", (q) => q.eq("path", team.competitionPath!))
      .unique();

    if (competition?.lastSyncError) {
      return {
        hasApiAccess: true,
        competitionPath: team.competitionPath,
        lastSyncedAt: competition.lastSyncedAt ?? null,
        lastSyncError: competition.lastSyncError,
        messageKey: "calendar_sync_error" as const,
      };
    }

    if (!competition?.lastSyncedAt) {
      return {
        hasApiAccess: true,
        competitionPath: team.competitionPath,
        lastSyncedAt: null,
        lastSyncError: null,
        messageKey: "calendar_sync_pending" as const,
      };
    }

    return {
      hasApiAccess: true,
      competitionPath: team.competitionPath,
      lastSyncedAt: competition.lastSyncedAt,
      lastSyncError: null,
      messageKey: "calendar_available" as const,
    };
  },
});

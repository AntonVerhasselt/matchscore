import { ConvexError, v } from "convex/values";

import type { GenericMutationCtx } from "convex/server";
import { applyDisplayNameDisambiguation } from "../lib/voetbalinbelgie/disambiguateTeamNames";
import { normalizeCompetitionPath } from "../lib/voetbalinbelgie/allowlist";
import { internalMutation } from "../_generated/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import {
  findFootballTeamForUpsert,
  findOrphanFootballTeamForUpgrade,
  requireFootballTeamId,
} from "./helpers";
import {
  competitionStandingInputValidator,
  upsertCompetitionArgsValidator,
  upsertFootballTeamArgsValidator,
  upsertMatchArgsValidator,
} from "./validators";

type MatchUpsertInput = {
  vibMatchKey: string;
  homeVibTeamName: string;
  awayVibTeamName: string;
  kickoffAt: number;
  status: string;
  homeGoals?: number;
  awayGoals?: number;
  resultText?: string;
};

const matchSnapshotInputValidator = v.object({
  vibMatchKey: v.string(),
  homeVibTeamName: v.string(),
  awayVibTeamName: v.string(),
  kickoffAt: v.number(),
  status: v.string(),
  homeGoals: v.optional(v.number()),
  awayGoals: v.optional(v.number()),
  resultText: v.optional(v.string()),
});

async function loadCompetitionForPath(
  ctx: GenericMutationCtx<DataModel>,
  competitionPath: string,
): Promise<Doc<"competitions">> {
  const competition = await ctx.db
    .query("competitions")
    .withIndex("by_path", (q) =>
      q.eq("path", normalizeCompetitionPath(competitionPath)),
    )
    .unique();

  if (!competition) {
    throw new ConvexError(`Competition not found for path ${competitionPath}`);
  }

  return competition;
}

function assertCompetitionSourceMatch(
  competition: Doc<"competitions">,
  sourceCompetitionId: number,
): void {
  if (competition.sourceCompetitionId !== sourceCompetitionId) {
    throw new ConvexError(
      `Competition/sourceCompetitionId mismatch for path ${competition.path}: expected ${competition.sourceCompetitionId}, got ${sourceCompetitionId}`,
    );
  }
}

async function replaceStandingsForCompetition(
  ctx: GenericMutationCtx<DataModel>,
  competitionId: Id<"competitions">,
  sourceCompetitionId: number,
  rows: Array<{
    vibTeamName: string;
    position: number;
    matches: number;
    wins: number;
    ties: number;
    losses: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    pointsPunished: string;
    shirt?: string;
    vibLogoFile?: string;
  }>,
): Promise<number> {
  const resolvedRows = await Promise.all(
    rows.map(async (row) => {
      const teamId = await requireFootballTeamId(
        ctx,
        sourceCompetitionId,
        row.vibTeamName,
      );
      return { row, teamId };
    }),
  );

  const existingRows = await ctx.db
    .query("competitionStandings")
    .withIndex("by_competitionId_and_teamId", (q) =>
      q.eq("competitionId", competitionId),
    )
    .collect();

  for (const row of existingRows) {
    await ctx.db.delete(row._id);
  }

  for (const { row, teamId } of resolvedRows) {
    await ctx.db.insert("competitionStandings", {
      competitionId,
      teamId,
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
    });
  }

  return rows.length;
}

async function upsertMatchForCompetition(
  ctx: GenericMutationCtx<DataModel>,
  competitionId: Id<"competitions">,
  sourceCompetitionId: number,
  args: MatchUpsertInput,
): Promise<Id<"matches">> {
  const homeTeamId = await requireFootballTeamId(
    ctx,
    sourceCompetitionId,
    args.homeVibTeamName,
  );
  const awayTeamId = await requireFootballTeamId(
    ctx,
    sourceCompetitionId,
    args.awayVibTeamName,
  );

  const now = Date.now();
  const fields = {
    competitionId,
    vibMatchKey: args.vibMatchKey,
    homeTeamId,
    awayTeamId,
    kickoffAt: args.kickoffAt,
    status: args.status,
    homeGoals: args.homeGoals,
    awayGoals: args.awayGoals,
    resultText: args.resultText,
    updatedAt: now,
  };

  const existing = await ctx.db
    .query("matches")
    .withIndex("by_vibMatchKey", (q) => q.eq("vibMatchKey", args.vibMatchKey))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }

  return await ctx.db.insert("matches", fields);
}

export const upsertFootballTeam = internalMutation({
  args: upsertFootballTeamArgsValidator,
  returns: v.id("footballTeams"),
  handler: async (ctx, args) => {
    const now = Date.now();
    let existing = await findFootballTeamForUpsert(ctx, {
      stamnummer: args.stamnummer,
      sourceCompetitionId: args.sourceCompetitionId,
      slugPath: args.slugPath,
      name: args.name,
    });

    if (!existing) {
      existing = await findOrphanFootballTeamForUpgrade(ctx, {
        stamnummer: args.stamnummer,
        name: args.name,
        slugPath: args.slugPath,
        sourceCompetitionId: args.sourceCompetitionId,
      });
    }

    const fields = {
      name: args.name,
      vibTeamName: args.vibTeamName,
      stamnummer: args.stamnummer,
      slugPath: args.slugPath,
      slug: args.slug,
      parentStamnummer: args.parentStamnummer,
      sourceCompetitionId: args.sourceCompetitionId,
      competitionPath: args.competitionPath,
      tabLabel: args.tabLabel,
      website: args.website,
      telephone: args.telephone,
      address: args.address,
      province: args.province,
      logoStorageId: args.logoStorageId,
      logoSourceUrl: args.logoSourceUrl,
      importSource: args.importSource,
      importedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }

    return await ctx.db.insert("footballTeams", fields);
  },
});

export const upsertCompetition = internalMutation({
  args: upsertCompetitionArgsValidator,
  returns: v.id("competitions"),
  handler: async (ctx, args) => {
    const path = normalizeCompetitionPath(args.path);
    const existing = await ctx.db
      .query("competitions")
      .withIndex("by_path", (q) => q.eq("path", path))
      .unique();

    const fields = {
      sourceCompetitionId: args.sourceCompetitionId,
      path,
      title: args.title,
      district: args.district,
      season: args.season,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }

    return await ctx.db.insert("competitions", fields);
  },
});

export const replaceCompetitionStandings = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    sourceCompetitionId: v.number(),
    rows: v.array(competitionStandingInputValidator),
  },
  returns: v.number(),
  handler: async (ctx, args) =>
    replaceStandingsForCompetition(
      ctx,
      args.competitionId,
      args.sourceCompetitionId,
      args.rows,
    ),
});

export const replaceCompetitionSnapshot = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    sourceCompetitionId: v.number(),
    competitionPath: v.string(),
    standings: v.array(competitionStandingInputValidator),
    matches: v.array(matchSnapshotInputValidator),
  },
  returns: v.object({
    standingCount: v.number(),
    matchCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const competition = await loadCompetitionForPath(ctx, args.competitionPath);
    if (competition._id !== args.competitionId) {
      throw new ConvexError(
        `Competition id mismatch for path ${args.competitionPath}`,
      );
    }
    assertCompetitionSourceMatch(competition, args.sourceCompetitionId);

    for (const match of args.matches) {
      await upsertMatchForCompetition(
        ctx,
        args.competitionId,
        args.sourceCompetitionId,
        match,
      );
    }

    const standingCount = await replaceStandingsForCompetition(
      ctx,
      args.competitionId,
      args.sourceCompetitionId,
      args.standings,
    );

    return {
      standingCount,
      matchCount: args.matches.length,
    };
  },
});

export const upsertMatch = internalMutation({
  args: upsertMatchArgsValidator,
  returns: v.id("matches"),
  handler: async (ctx, args) => {
    const competition = await loadCompetitionForPath(ctx, args.competitionPath);
    assertCompetitionSourceMatch(competition, args.sourceCompetitionId);

    return await upsertMatchForCompetition(
      ctx,
      competition._id,
      args.sourceCompetitionId,
      args,
    );
  },
});

export const patchCompetitionSyncStatus = internalMutation({
  args: {
    competitionId: v.id("competitions"),
    lastSyncedAt: v.optional(v.number()),
    lastSyncError: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.competitionId);
    if (!existing) {
      throw new ConvexError("Competition not found");
    }

    const next: {
      sourceCompetitionId: number;
      path: string;
      title: string;
      district: string;
      season: string;
      lastSyncedAt?: number;
      lastSyncError?: string;
    } = {
      sourceCompetitionId: existing.sourceCompetitionId,
      path: existing.path,
      title: existing.title,
      district: existing.district,
      season: existing.season,
      lastSyncedAt: args.lastSyncedAt ?? existing.lastSyncedAt,
    };

    if (args.lastSyncError === null) {
      // Omit lastSyncError to clear a previous failure.
    } else if (args.lastSyncError !== undefined) {
      next.lastSyncError = args.lastSyncError;
    } else if (existing.lastSyncError !== undefined) {
      next.lastSyncError = existing.lastSyncError;
    }

    await ctx.db.replace(args.competitionId, next);
    return null;
  },
});

/** Removes orphan rows superseded by a competition-linked import for the same club team. */
export const dedupeOrphanFootballTeams = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const orphans = await ctx.db
      .query("footballTeams")
      .filter((q) => q.eq(q.field("sourceCompetitionId"), undefined))
      .collect();

    let removed = 0;

    for (const orphan of orphans) {
      if (!orphan.stamnummer) {
        continue;
      }

      const upgraded = await ctx.db
        .query("footballTeams")
        .withIndex("by_stamnummer_and_name", (q) =>
          q.eq("stamnummer", orphan.stamnummer!).eq("name", orphan.name),
        )
        .collect();

      const hasLinkedCopy = upgraded.some(
        (team) =>
          team._id !== orphan._id &&
          team.sourceCompetitionId !== undefined &&
          (orphan.slugPath ? team.slugPath === orphan.slugPath : true),
      );

      if (hasLinkedCopy) {
        await ctx.db.delete(orphan._id);
        removed += 1;
      }
    }

    return removed;
  },
});

/** Backfills unique display names for clubs with duplicate VoetbalInBelgië team names. */
export const repairDuplicateTeamDisplayNames = internalMutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    clubsWithDuplicates: v.number(),
  }),
  handler: async (ctx) => {
    const allTeams = await ctx.db.query("footballTeams").collect();
    const byStamnummer = new Map<string, typeof allTeams>();

    for (const team of allTeams) {
      if (!team.stamnummer) {
        continue;
      }

      const group = byStamnummer.get(team.stamnummer) ?? [];
      group.push(team);
      byStamnummer.set(team.stamnummer, group);
    }

    let updated = 0;
    let clubsWithDuplicates = 0;

    for (const teams of byStamnummer.values()) {
      if (teams.length < 2) {
        continue;
      }

      const duplicateVibNames = new Set<string>();
      const vibNameCounts = new Map<string, number>();
      for (const team of teams) {
        vibNameCounts.set(
          team.vibTeamName,
          (vibNameCounts.get(team.vibTeamName) ?? 0) + 1,
        );
      }
      for (const [name, count] of vibNameCounts) {
        if (count > 1) {
          duplicateVibNames.add(name);
        }
      }

      if (duplicateVibNames.size === 0) {
        continue;
      }

      clubsWithDuplicates += 1;

      const disambiguated = applyDisplayNameDisambiguation(
        teams.map((team) => ({
          teamName: team.vibTeamName,
          tabLabel: team.tabLabel,
          competitionPath: team.competitionPath,
          teamId: team._id,
        })),
      );

      for (const result of disambiguated) {
        const existing = teams.find((team) => team._id === result.teamId);
        if (!existing) {
          continue;
        }

        if (
          existing.name !== result.displayName ||
          existing.vibTeamName !== result.vibTeamName
        ) {
          await ctx.db.patch(result.teamId, {
            name: result.displayName,
            vibTeamName: result.vibTeamName,
          });
          updated += 1;
        }
      }
    }

    return { updated, clubsWithDuplicates };
  },
});

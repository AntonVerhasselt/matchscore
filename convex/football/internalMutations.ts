import { ConvexError, v } from "convex/values";

import type { GenericMutationCtx } from "convex/server";
import { applyDisplayNameDisambiguation } from "../lib/voetbalinbelgie/disambiguateTeamNames";
import { normalizeCompetitionPath } from "../lib/voetbalinbelgie/allowlist";
import {
  buildLogicalMatchKey,
  buildSemanticMatchKey,
  groupMatchesByLogicalKey,
  pickCanonicalMatch,
} from "../lib/voetbalinbelgie/matchIdentity";
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

async function findExistingMatchForUpsert(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    competitionId: Id<"competitions">;
    vibMatchKey: string;
    kickoffAt: number;
    homeTeamId: Id<"footballTeams">;
    awayTeamId: Id<"footballTeams">;
    homeVibTeamName: string;
    awayVibTeamName: string;
  },
): Promise<Doc<"matches"> | null> {
  const byKey = await ctx.db
    .query("matches")
    .withIndex("by_vibMatchKey", (q) => q.eq("vibMatchKey", args.vibMatchKey))
    .first();
  if (byKey) {
    return byKey;
  }

  const candidates = await ctx.db
    .query("matches")
    .withIndex("by_competitionId_and_kickoffAt", (q) =>
      q.eq("competitionId", args.competitionId).eq("kickoffAt", args.kickoffAt),
    )
    .collect();

  const logicalMatches = candidates.filter(
    (match) =>
      match.homeTeamId === args.homeTeamId &&
      match.awayTeamId === args.awayTeamId,
  );

  if (logicalMatches.length > 0) {
    return pickCanonicalMatch(logicalMatches);
  }

  const targetSemanticKey = buildSemanticMatchKey({
    competitionId: args.competitionId,
    kickoffAt: args.kickoffAt,
    homeVibTeamName: args.homeVibTeamName,
    awayVibTeamName: args.awayVibTeamName,
  });

  const semanticMatches: Doc<"matches">[] = [];
  for (const match of candidates) {
    const homeTeam = await ctx.db.get(match.homeTeamId);
    const awayTeam = await ctx.db.get(match.awayTeamId);
    if (!homeTeam || !awayTeam) {
      continue;
    }

    const semanticKey = buildSemanticMatchKey({
      competitionId: match.competitionId,
      kickoffAt: match.kickoffAt,
      homeVibTeamName: homeTeam.vibTeamName,
      awayVibTeamName: awayTeam.vibTeamName,
    });
    if (semanticKey === targetSemanticKey) {
      semanticMatches.push(match);
    }
  }

  if (semanticMatches.length === 0) {
    return null;
  }

  return pickCanonicalMatch(semanticMatches);
}

async function dedupeCompetitionMatches(
  ctx: GenericMutationCtx<DataModel>,
  competitionId: Id<"competitions">,
): Promise<number> {
  const matches = await ctx.db
    .query("matches")
    .withIndex("by_competitionId_and_kickoffAt", (q) =>
      q.eq("competitionId", competitionId),
    )
    .collect();

  let removed = 0;

  for (const group of groupMatchesByLogicalKey(matches).values()) {
    if (group.length < 2) {
      continue;
    }

    const keep = pickCanonicalMatch(group);
    for (const duplicate of group) {
      if (duplicate._id !== keep._id) {
        await ctx.db.delete(duplicate._id);
        removed += 1;
      }
    }
  }

  const remaining = await ctx.db
    .query("matches")
    .withIndex("by_competitionId_and_kickoffAt", (q) =>
      q.eq("competitionId", competitionId),
    )
    .collect();

  const semanticGroups = new Map<string, Doc<"matches">[]>();
  for (const match of remaining) {
    const homeTeam = await ctx.db.get(match.homeTeamId);
    const awayTeam = await ctx.db.get(match.awayTeamId);
    if (!homeTeam || !awayTeam) {
      continue;
    }

    const semanticKey = buildSemanticMatchKey({
      competitionId: match.competitionId,
      kickoffAt: match.kickoffAt,
      homeVibTeamName: homeTeam.vibTeamName,
      awayVibTeamName: awayTeam.vibTeamName,
    });
    const group = semanticGroups.get(semanticKey) ?? [];
    group.push(match);
    semanticGroups.set(semanticKey, group);
  }

  for (const group of semanticGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    const keep = pickCanonicalMatch(group);
    for (const duplicate of group) {
      if (duplicate._id !== keep._id) {
        await ctx.db.delete(duplicate._id);
        removed += 1;
      }
    }
  }

  return removed;
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

  const existing = await findExistingMatchForUpsert(ctx, {
    competitionId,
    vibMatchKey: args.vibMatchKey,
    kickoffAt: args.kickoffAt,
    homeTeamId,
    awayTeamId,
    homeVibTeamName: args.homeVibTeamName,
    awayVibTeamName: args.awayVibTeamName,
  });

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
    removedStaleMatches: v.number(),
    removedDuplicateMatches: v.number(),
  }),
  handler: async (ctx, args) => {
    const competition = await loadCompetitionForPath(ctx, args.competitionPath);
    if (competition._id !== args.competitionId) {
      throw new ConvexError(
        `Competition id mismatch for path ${args.competitionPath}`,
      );
    }
    assertCompetitionSourceMatch(competition, args.sourceCompetitionId);

    const syncedMatchIds = new Set<Id<"matches">>();
    const syncedLogicalKeys = new Set<string>();

    for (const match of args.matches) {
      const matchId = await upsertMatchForCompetition(
        ctx,
        args.competitionId,
        args.sourceCompetitionId,
        match,
      );
      syncedMatchIds.add(matchId);

      const homeTeamId = await requireFootballTeamId(
        ctx,
        args.sourceCompetitionId,
        match.homeVibTeamName,
      );
      const awayTeamId = await requireFootballTeamId(
        ctx,
        args.sourceCompetitionId,
        match.awayVibTeamName,
      );
      syncedLogicalKeys.add(
        buildLogicalMatchKey({
          competitionId: args.competitionId,
          kickoffAt: match.kickoffAt,
          homeTeamId,
          awayTeamId,
        }),
      );
    }

    const existingMatches = await ctx.db
      .query("matches")
      .withIndex("by_competitionId_and_kickoffAt", (q) =>
        q.eq("competitionId", args.competitionId),
      )
      .collect();

    let removedStaleMatches = 0;
    for (const match of existingMatches) {
      const logicalKey = buildLogicalMatchKey(match);
      if (
        !syncedMatchIds.has(match._id) &&
        !syncedLogicalKeys.has(logicalKey)
      ) {
        await ctx.db.delete(match._id);
        removedStaleMatches += 1;
      }
    }

    const removedDuplicateMatches = await dedupeCompetitionMatches(
      ctx,
      args.competitionId,
    );

    const standingCount = await replaceStandingsForCompetition(
      ctx,
      args.competitionId,
      args.sourceCompetitionId,
      args.standings,
    );

    return {
      standingCount,
      matchCount: args.matches.length,
      removedStaleMatches,
      removedDuplicateMatches,
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

/** Removes duplicate match rows caused by legacy vibMatchKey format changes. */
export const dedupeDuplicateMatches = internalMutation({
  args: {
    competitionId: v.optional(v.id("competitions")),
  },
  returns: v.object({
    competitionsProcessed: v.number(),
    removed: v.number(),
  }),
  handler: async (ctx, args) => {
    let competitionsProcessed = 0;
    let removed = 0;

    if (args.competitionId) {
      removed += await dedupeCompetitionMatches(ctx, args.competitionId);
      competitionsProcessed = 1;
      return { competitionsProcessed, removed };
    }

    const competitions = await ctx.db.query("competitions").collect();
    for (const competition of competitions) {
      removed += await dedupeCompetitionMatches(ctx, competition._id);
      competitionsProcessed += 1;
    }

    return { competitionsProcessed, removed };
  },
});

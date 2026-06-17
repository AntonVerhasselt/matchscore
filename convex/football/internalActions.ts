import { v } from "convex/values";

import {
  ALLOWED_COMPETITION_PATHS,
  isCompetitionPathAllowed,
} from "../lib/voetbalinbelgie/allowlist";
import { collectRequiredTeamNames } from "../lib/voetbalinbelgie/teamNames";
import { fetchCompetitionJson, fetchStamnummersHtml } from "../voetbalinbelgie/fetch";
import { parseStamnummersHtml } from "../lib/voetbalinbelgie/parseHtml";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { importClubPage, slugPathFromApiHref } from "./importClubPage";
import { sleep } from "./logoImport";

/** Clubs processed per action invocation — tuned to stay under action timeout. */
export const IMPORT_BATCH_SIZE = 50;
const CLUB_FETCH_DELAY_MS = 100;

const importBatchResultValidator = v.object({
  done: v.boolean(),
  startIndex: v.number(),
  nextStartIndex: v.union(v.number(), v.null()),
  processed: v.number(),
  skipped: v.number(),
  total: v.number(),
  errors: v.array(v.string()),
});

const validationResultValidator = v.object({
  ok: v.boolean(),
  results: v.array(
    v.object({
      path: v.string(),
      competitionId: v.number(),
      ok: v.boolean(),
      missing: v.array(v.string()),
    }),
  ),
});

async function collectMissingCompetitionTeams(ctx: ActionCtx): Promise<
  Array<{
    path: string;
    competitionId: number;
    missing: string[];
    slugPaths: string[];
    fetchFailed?: boolean;
  }>
> {
  const apiKey = process.env.VOETBALINBELGIE_API_KEY;
  if (!apiKey) {
    throw new Error("VOETBALINBELGIE_API_KEY is not configured");
  }

  const results = [];

  for (const path of ALLOWED_COMPETITION_PATHS) {
    if (!isCompetitionPathAllowed(path)) {
      continue;
    }

    try {
      const dto = await fetchCompetitionJson(path, apiKey);
      const missing: string[] = [];
      const slugPaths = new Set<string>();

      for (const name of collectRequiredTeamNames(dto)) {
        const found: boolean = await ctx.runQuery(
          internal.football.internalQueries.isTeamImportedForCompetition,
          {
            sourceCompetitionId: dto.meta.id,
            vibTeamName: name,
          },
        );
        if (found) {
          continue;
        }

        missing.push(name);
        const related = dto.relatedTeams.find((team) => team.name === name);
        if (related?.href) {
          slugPaths.add(slugPathFromApiHref(related.href));
        }
      }

      results.push({
        path,
        competitionId: dto.meta.id,
        missing,
        slugPaths: [...slugPaths],
      });
    } catch (error) {
      console.log(
        JSON.stringify({
          event: "football_competition_fetch_failed",
          path,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      results.push({
        path,
        competitionId: 0,
        missing: [],
        slugPaths: [],
        fetchFailed: true,
      });
    }
  }

  return results;
}

export const importClubBatch = internalAction({
  args: {
    startIndex: v.number(),
    batchSize: v.optional(v.number()),
    skipCompleteClubs: v.optional(v.boolean()),
  },
  returns: importBatchResultValidator,
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? IMPORT_BATCH_SIZE;
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error(`batchSize must be a positive integer, got ${batchSize}`);
    }
    if (!Number.isInteger(args.startIndex) || args.startIndex < 0) {
      throw new Error(
        `startIndex must be a non-negative integer, got ${args.startIndex}`,
      );
    }

    const stamnummersHtml = await fetchStamnummersHtml();
    const entries = parseStamnummersHtml(stamnummersHtml);
    const batch = entries.slice(args.startIndex, args.startIndex + batchSize);
    const errors: string[] = [];
    let skipped = 0;

    for (const entry of batch) {
      try {
        if (args.skipCompleteClubs) {
          const complete: boolean = await ctx.runQuery(
            internal.football.internalQueries.isClubPageImportComplete,
            { slugPath: entry.slugPath },
          );
          if (complete) {
            skipped += 1;
            continue;
          }
        }

        await importClubPage(ctx, entry);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown import error";
        errors.push(`${entry.slugPath}: ${message}`);
      }

      if (CLUB_FETCH_DELAY_MS > 0) {
        await sleep(CLUB_FETCH_DELAY_MS);
      }
    }

    const nextStartIndex = args.startIndex + batch.length;
    const done = nextStartIndex >= entries.length;

    if (!done && batch.length === 0) {
      throw new Error(
        `importClubBatch made no progress at startIndex ${args.startIndex}`,
      );
    }

    if (!done) {
      await ctx.scheduler.runAfter(
        0,
        internal.football.internalActions.importClubBatch,
        {
          startIndex: nextStartIndex,
          batchSize,
          skipCompleteClubs: args.skipCompleteClubs,
        },
      );
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.football.internalActions.repairMissingCompetitionTeams,
        {},
      );
    }

    console.log(
      JSON.stringify({
        event: "football_import_batch",
        startIndex: args.startIndex,
        processed: batch.length,
        skipped,
        total: entries.length,
        nextStartIndex: done ? null : nextStartIndex,
        errorCount: errors.length,
      }),
    );

    return {
      done,
      startIndex: args.startIndex,
      nextStartIndex: done ? null : nextStartIndex,
      processed: batch.length,
      skipped,
      total: entries.length,
      errors,
    };
  },
});

export const repairMissingCompetitionTeams = internalAction({
  args: {
    slugPaths: v.optional(v.array(v.string())),
  },
  returns: validationResultValidator,
  handler: async (ctx, args) => {
    const missingGroups = await collectMissingCompetitionTeams(ctx);
    const slugPaths =
      args.slugPaths ??
      [
        ...new Set(
          missingGroups.flatMap((group) => group.slugPaths),
        ),
      ];

    for (const slugPath of slugPaths) {
      try {
        await importClubPage(ctx, { slugPath });
      } catch (error) {
        console.log(
          JSON.stringify({
            event: "football_import_repair_error",
            slugPath,
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        );
      }
    }

    const removedOrphans: number = await ctx.runMutation(
      internal.football.internalMutations.dedupeOrphanFootballTeams,
      {},
    );

    const results = [];
    for (const group of missingGroups) {
      const stillMissing: string[] = [];
      for (const name of group.missing) {
        const found: boolean = await ctx.runQuery(
          internal.football.internalQueries.isTeamImportedForCompetition,
          {
            sourceCompetitionId: group.competitionId,
            vibTeamName: name,
          },
        );
        if (!found) {
          stillMissing.push(name);
        }
      }

      results.push({
        path: group.path,
        competitionId: group.competitionId,
        ok: !group.fetchFailed && stillMissing.length === 0,
        missing: stillMissing,
      });
    }

    console.log(
      JSON.stringify({
        event: "football_import_repair_complete",
        repairedClubPages: slugPaths.length,
        removedOrphans,
        ok: results.every((result) => result.ok),
      }),
    );

    return {
      ok: results.every((result) => result.ok),
      results,
    };
  },
});

export const validateAllowlistedCompetitionTeams = internalAction({
  args: {},
  returns: validationResultValidator,
  handler: async (ctx) => {
    const missingGroups = await collectMissingCompetitionTeams(ctx);
    return {
      ok: missingGroups.every(
        (group) => !group.fetchFailed && group.missing.length === 0,
      ),
      results: missingGroups.map((group) => ({
        path: group.path,
        competitionId: group.competitionId,
        ok: !group.fetchFailed && group.missing.length === 0,
        missing: group.missing,
      })),
    };
  },
});

import {
  isCompetitionPathAllowed,
  normalizeCompetitionPath,
} from "../lib/voetbalinbelgie/allowlist";
import { mergeCompetitionMatches } from "../lib/voetbalinbelgie/matchMerge";
import { collectRequiredTeamNames } from "../lib/voetbalinbelgie/teamNames";
import { shouldFetchCompetition } from "../lib/voetbalinbelgie/syncSchedule";
import { buildVibMatchKey } from "../lib/voetbalinbelgie/vibMatchKey";
import { fetchCompetitionJson } from "../voetbalinbelgie/fetch";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type SyncCompetitionResult = {
  status: "synced" | "skipped" | "error";
  path: string;
  reason?: string;
  message?: string;
  matchCount?: number;
};

export async function runSyncCompetition(
  ctx: ActionCtx,
  args: { path: string; force?: boolean },
): Promise<SyncCompetitionResult> {
  const path = normalizeCompetitionPath(args.path);

  if (!isCompetitionPathAllowed(path)) {
    return { status: "skipped", path, reason: "not_allowlisted" };
  }

  const apiKey = process.env.VOETBALINBELGIE_API_KEY;
  if (!apiKey) {
    return {
      status: "error",
      path,
      message: "VOETBALINBELGIE_API_KEY is not configured",
    };
  }

  const syncState = await ctx.runQuery(
    internal.football.internalQueries.getCompetitionSyncState,
    { path },
  );
  const now = Date.now();

  if (
    !shouldFetchCompetition(syncState?.lastSyncedAt, now, {
      force: args.force ?? false,
    })
  ) {
    return { status: "skipped", path, reason: "ttl" };
  }

  let competitionId: Id<"competitions"> | undefined = syncState?.competitionId;

  try {
    const dto = await fetchCompetitionJson(path, apiKey);

    competitionId = await ctx.runMutation(
      internal.football.internalMutations.upsertCompetition,
      {
        sourceCompetitionId: dto.meta.id,
        path,
        title: dto.meta.title,
        district: dto.meta.district,
        season: dto.meta.season,
      },
    );

    const validation: { ok: boolean; missing: string[] } = await ctx.runQuery(
      internal.football.internalQueries.validateCompetitionTeamsImported,
      {
        sourceCompetitionId: dto.meta.id,
        teamNames: collectRequiredTeamNames(dto),
      },
    );

    if (!validation.ok) {
      const message = `Missing imported teams for competition ${dto.meta.id}: ${validation.missing.join(", ")}`;
      await ctx.runMutation(
        internal.football.internalMutations.patchCompetitionSyncStatus,
        {
          competitionId,
          lastSyncError: message,
        },
      );
      return { status: "error", path, message };
    }

    const mergedMatches = mergeCompetitionMatches(
      dto.meta.id,
      dto.results,
      dto.program,
    );

    await ctx.runMutation(
      internal.football.internalMutations.replaceCompetitionSnapshot,
      {
        competitionId,
        sourceCompetitionId: dto.meta.id,
        competitionPath: path,
        standings: dto.leaguetable.map((row) => ({
          vibTeamName: row.name,
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
          vibLogoFile: row.logo,
        })),
        matches: mergedMatches.map((row) => ({
          vibMatchKey: buildVibMatchKey(
            dto.meta.id,
            row.date,
            row.home,
            row.away,
          ),
          homeVibTeamName: row.home,
          awayVibTeamName: row.away,
          kickoffAt: Date.parse(row.date),
          status: row.status,
          homeGoals: row.homeGoals,
          awayGoals: row.awayGoals,
          resultText: row.result,
        })),
      },
    );

    await ctx.runMutation(
      internal.football.internalMutations.patchCompetitionSyncStatus,
      {
        competitionId,
        lastSyncedAt: now,
        lastSyncError: null,
      },
    );

    console.log(
      JSON.stringify({
        event: "football_competition_sync",
        path,
        matchCount: mergedMatches.length,
        forced: args.force ?? false,
      }),
    );

    return {
      status: "synced",
      path,
      matchCount: mergedMatches.length,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown competition sync error";

    if (competitionId) {
      await ctx.runMutation(
        internal.football.internalMutations.patchCompetitionSyncStatus,
        {
          competitionId,
          lastSyncError: message,
        },
      );
    }

    console.log(
      JSON.stringify({
        event: "football_competition_sync_error",
        path,
        error: message,
      }),
    );

    return { status: "error", path, message };
  }
}

import { ConvexError } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import {
  collectRequiredTeamNames,
  getFootballTeamUpsertKey,
} from "../lib/voetbalinbelgie/teamNames";
import type { ParsedCompetitionDto } from "../lib/voetbalinbelgie/types";
import { buildVibMatchKey } from "../lib/voetbalinbelgie/vibMatchKey";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

type DbCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export { buildVibMatchKey };

export async function resolveFootballTeamId(
  ctx: DbCtx,
  sourceCompetitionId: number,
  vibTeamName: string,
): Promise<Id<"footballTeams"> | null> {
  const team = await ctx.db
    .query("footballTeams")
    .withIndex("by_competition_and_vibTeamName", (q) =>
      q
        .eq("sourceCompetitionId", sourceCompetitionId)
        .eq("vibTeamName", vibTeamName),
    )
    .unique();

  return team?._id ?? null;
}

export async function requireFootballTeamId(
  ctx: DbCtx,
  sourceCompetitionId: number,
  vibTeamName: string,
): Promise<Id<"footballTeams">> {
  const teamId = await resolveFootballTeamId(ctx, sourceCompetitionId, vibTeamName);
  if (!teamId) {
    throw new ConvexError(
      `Missing imported team for competition ${sourceCompetitionId}: ${vibTeamName}`,
    );
  }
  return teamId;
}

export async function findFootballTeamForUpsert(
  ctx: DbCtx,
  args: {
    stamnummer?: string;
    sourceCompetitionId?: number;
    slugPath?: string;
    name: string;
  },
): Promise<Doc<"footballTeams"> | null> {
  const key = getFootballTeamUpsertKey(args);

  switch (key.kind) {
    case "stamnummer_and_competition": {
      return await ctx.db
        .query("footballTeams")
        .withIndex("by_stamnummer_and_sourceCompetitionId", (q) =>
          q
            .eq("stamnummer", key.stamnummer)
            .eq("sourceCompetitionId", key.sourceCompetitionId),
        )
        .unique();
    }
    case "stamnummer_and_name": {
      return await ctx.db
        .query("footballTeams")
        .withIndex("by_stamnummer_and_name", (q) =>
          q.eq("stamnummer", key.stamnummer).eq("name", key.name),
        )
        .unique();
    }
    case "slug_path_and_name": {
      return await ctx.db
        .query("footballTeams")
        .filter((q) =>
          q.and(
            q.eq(q.field("slugPath"), key.slugPath),
            q.eq(q.field("name"), key.name),
          ),
        )
        .first();
    }
  }
}

export async function findOrphanFootballTeamForUpgrade(
  ctx: DbCtx,
  args: {
    stamnummer?: string;
    name: string;
    slugPath?: string;
    sourceCompetitionId?: number;
  },
): Promise<Doc<"footballTeams"> | null> {
  if (!args.stamnummer || args.sourceCompetitionId === undefined) {
    return null;
  }

  const orphan = await ctx.db
    .query("footballTeams")
    .withIndex("by_stamnummer_and_name", (q) =>
      q.eq("stamnummer", args.stamnummer!).eq("name", args.name),
    )
    .unique();

  if (!orphan || orphan.sourceCompetitionId !== undefined) {
    return null;
  }

  if (args.slugPath && orphan.slugPath && orphan.slugPath !== args.slugPath) {
    return null;
  }

  return orphan;
}

export async function assertAllCompetitionTeamsImported(
  ctx: DbCtx,
  dto: ParsedCompetitionDto,
): Promise<void> {
  const missing: string[] = [];

  for (const name of collectRequiredTeamNames(dto)) {
    const teamId = await resolveFootballTeamId(ctx, dto.meta.id, name);
    if (!teamId) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new ConvexError(
      `Missing imported teams for competition ${dto.meta.id}: ${missing.join(", ")}`,
    );
  }
}

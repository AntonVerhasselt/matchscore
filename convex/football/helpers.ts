import { ConvexError } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { collectRequiredTeamNames } from "../lib/voetbalinbelgie/teamNames";
import type { ParsedCompetitionDto } from "../lib/voetbalinbelgie/types";
import { buildVibMatchKey } from "../lib/voetbalinbelgie/vibMatchKey";
import type { DataModel, Id } from "../_generated/dataModel";

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

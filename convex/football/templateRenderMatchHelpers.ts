import { buildTemplateMatch } from "../../lib/football/build-template-match";
import { selectSampleMatch } from "../../lib/football/select-sample-match";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { AutomationType } from "../automations/constants";

const LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;

export async function fetchTemplateRenderMatchForTeam(
  ctx: QueryCtx,
  args: {
    footballTeamId: Id<"footballTeams">;
    automationType: AutomationType;
    now: number;
  },
) {
  const minKickoff = args.now - LOOKBACK_MS;

  const homeMatches = await ctx.db
    .query("matches")
    .withIndex("by_homeTeamId_and_kickoffAt", (q) =>
      q.eq("homeTeamId", args.footballTeamId).gte("kickoffAt", minKickoff),
    )
    .collect();

  const awayMatches = await ctx.db
    .query("matches")
    .withIndex("by_awayTeamId_and_kickoffAt", (q) =>
      q.eq("awayTeamId", args.footballTeamId).gte("kickoffAt", minKickoff),
    )
    .collect();

  const matchById = new Map<string, Doc<"matches">>();
  for (const match of [...homeMatches, ...awayMatches]) {
    matchById.set(match._id as string, match);
  }

  const selected = selectSampleMatch(
    [...matchById.values()],
    args.automationType,
    args.now,
  );
  if (!selected) {
    return null;
  }

  const homeTeam = await ctx.db.get(selected.homeTeamId);
  const awayTeam = await ctx.db.get(selected.awayTeamId);
  if (!homeTeam || !awayTeam) {
    return null;
  }

  return buildTemplateMatch({
    kickoffAt: selected.kickoffAt,
    status: selected.status,
    homeGoals: selected.homeGoals,
    awayGoals: selected.awayGoals,
    resultText: selected.resultText,
    homeTeam: {
      name: homeTeam.name,
      logoStorageId: homeTeam.logoStorageId,
      address: homeTeam.address,
    },
    awayTeam: {
      name: awayTeam.name,
      logoStorageId: awayTeam.logoStorageId,
    },
  });
}

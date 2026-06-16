import { v } from "convex/values";
import { query } from "../_generated/server";
import { footballTeamSummaryValidator } from "./validators";

const MAX_RESULTS = 20;

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

    const teams = await ctx.db.query("footballTeams").collect();
    const matches = teams
      .filter((team) => team.name.toLowerCase().includes(normalizedQuery))
      .slice(0, MAX_RESULTS);

    return matches.map((team) => ({
      _id: team._id,
      name: team.name,
      vibTeamName: team.vibTeamName,
      stamnummer: team.stamnummer,
      competitionPath: team.competitionPath,
      sourceCompetitionId: team.sourceCompetitionId,
      logoStorageId: team.logoStorageId,
    }));
  },
});

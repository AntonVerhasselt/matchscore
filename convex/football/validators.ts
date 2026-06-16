import { v } from "convex/values";

export const footballTeamAddressValidator = v.object({
  street: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  city: v.optional(v.string()),
  region: v.optional(v.string()),
  country: v.optional(v.string()),
});

export const footballImportSourceValidator = v.union(
  v.literal("stamnummers"),
  v.literal("club_page"),
);

export const footballTeamSummaryValidator = v.object({
  _id: v.id("footballTeams"),
  name: v.string(),
  vibTeamName: v.string(),
  stamnummer: v.optional(v.string()),
  competitionPath: v.optional(v.string()),
  sourceCompetitionId: v.optional(v.number()),
  logoStorageId: v.optional(v.id("_storage")),
});

export const competitionStandingRowValidator = v.object({
  teamId: v.id("footballTeams"),
  position: v.number(),
  matches: v.number(),
  wins: v.number(),
  ties: v.number(),
  losses: v.number(),
  points: v.number(),
  goalsFor: v.number(),
  goalsAgainst: v.number(),
  pointsPunished: v.string(),
  shirt: v.optional(v.string()),
  vibLogoFile: v.optional(v.string()),
});

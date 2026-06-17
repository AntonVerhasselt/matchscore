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
  logoUrl: v.union(v.string(), v.null()),
});

export const footballTeamDetailValidator = v.object({
  _id: v.id("footballTeams"),
  name: v.string(),
  vibTeamName: v.string(),
  stamnummer: v.optional(v.string()),
  slugPath: v.optional(v.string()),
  competitionPath: v.optional(v.string()),
  sourceCompetitionId: v.optional(v.number()),
  tabLabel: v.optional(v.string()),
  website: v.optional(v.string()),
  telephone: v.optional(v.string()),
  address: v.optional(footballTeamAddressValidator),
  province: v.optional(v.string()),
  logoStorageId: v.optional(v.id("_storage")),
});

export const upsertFootballTeamArgsValidator = v.object({
  name: v.string(),
  vibTeamName: v.string(),
  stamnummer: v.optional(v.string()),
  slugPath: v.optional(v.string()),
  slug: v.optional(v.string()),
  parentStamnummer: v.optional(v.string()),
  sourceCompetitionId: v.optional(v.number()),
  competitionPath: v.optional(v.string()),
  tabLabel: v.optional(v.string()),
  website: v.optional(v.string()),
  telephone: v.optional(v.string()),
  address: v.optional(footballTeamAddressValidator),
  province: v.optional(v.string()),
  logoStorageId: v.optional(v.id("_storage")),
  logoSourceUrl: v.optional(v.string()),
  importSource: footballImportSourceValidator,
});

export const upsertCompetitionArgsValidator = v.object({
  sourceCompetitionId: v.number(),
  path: v.string(),
  title: v.string(),
  district: v.string(),
  season: v.string(),
});

export const competitionStandingInputValidator = v.object({
  vibTeamName: v.string(),
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

export const upsertMatchArgsValidator = v.object({
  sourceCompetitionId: v.number(),
  competitionPath: v.string(),
  vibMatchKey: v.string(),
  homeVibTeamName: v.string(),
  awayVibTeamName: v.string(),
  kickoffAt: v.number(),
  status: v.string(),
  homeGoals: v.optional(v.number()),
  awayGoals: v.optional(v.number()),
  resultText: v.optional(v.string()),
});

export const competitionStandingRowValidator = v.object({
  teamId: v.id("footballTeams"),
  teamName: v.string(),
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
  logoStorageId: v.optional(v.id("_storage")),
});

export const teamMatchSummaryValidator = v.object({
  _id: v.id("matches"),
  kickoffAt: v.number(),
  status: v.string(),
  homeTeamId: v.id("footballTeams"),
  awayTeamId: v.id("footballTeams"),
  homeTeamName: v.string(),
  awayTeamName: v.string(),
  opponentName: v.string(),
  opponentLogoUrl: v.union(v.string(), v.null()),
  homeGoals: v.optional(v.number()),
  awayGoals: v.optional(v.number()),
  resultText: v.optional(v.string()),
  isHome: v.boolean(),
  matchStatus: v.union(v.literal("upcoming"), v.literal("played")),
});

export const calendarAccessStatusValidator = v.object({
  hasApiAccess: v.boolean(),
  competitionPath: v.union(v.string(), v.null()),
  lastSyncedAt: v.union(v.number(), v.null()),
  lastSyncError: v.union(v.string(), v.null()),
  messageKey: v.union(
    v.literal("calendar_available"),
    v.literal("calendar_not_allowlisted"),
    v.literal("calendar_no_competition"),
    v.literal("calendar_sync_pending"),
    v.literal("calendar_sync_error"),
  ),
});

export const templateRenderClubValidator = v.object({
  name: v.string(),
  logoStorageId: v.optional(v.id("_storage")),
  logoUrl: v.union(v.string(), v.null()),
});

export const templateRenderMatchValidator = v.object({
  homeClub: templateRenderClubValidator,
  awayClub: templateRenderClubValidator,
  address: v.string(),
  kickoffAt: v.number(),
  homeScore: v.optional(v.number()),
  awayScore: v.optional(v.number()),
  status: v.optional(v.string()),
  resultText: v.optional(v.string()),
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  automationTypeValidator,
  canvasPresetValidator,
  postingChannelStatusesValidator,
} from "./automations/validators";
import {
  planTierValidator,
  subscriptionStatusValidator,
} from "./billing/validators";
import {
  footballImportSourceValidator,
  footballTeamAddressValidator,
} from "./football/validators";
import { localeValidator } from "./locales";

export default defineSchema({
  userSettings: defineTable({
    userId: v.string(),
    locale: localeValidator,
  }).index("by_userId", ["userId"]),

  pendingEmailLocales: defineTable({
    email: v.string(),
    locale: localeValidator,
  }).index("by_email", ["email"]),

  footballTeams: defineTable({
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
    vibLogoFile: v.optional(v.string()),
    importSource: footballImportSourceValidator,
    importedAt: v.number(),
  })
    .index("by_competition_and_vibTeamName", [
      "sourceCompetitionId",
      "vibTeamName",
    ])
    // Antwerp FC: same team name in two competitions — key by competition id, not name.
    .index("by_stamnummer_and_sourceCompetitionId", [
      "stamnummer",
      "sourceCompetitionId",
    ])
    .index("by_stamnummer_and_name", ["stamnummer", "name"])
    .index("by_slugPath_and_name", ["slugPath", "name"])
    .index("by_slugPath", ["slugPath"])
    .index("by_name", ["name"])
    .index("by_logoSourceUrl", ["logoSourceUrl"]),

  competitions: defineTable({
    sourceCompetitionId: v.number(),
    path: v.string(),
    title: v.string(),
    district: v.string(),
    season: v.string(),
    lastSyncedAt: v.optional(v.number()),
    lastSyncError: v.optional(v.string()),
  })
    .index("by_path", ["path"])
    .index("by_sourceCompetitionId", ["sourceCompetitionId"]),

  competitionStandings: defineTable({
    competitionId: v.id("competitions"),
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
  }).index("by_competitionId_and_teamId", ["competitionId", "teamId"]),

  matches: defineTable({
    competitionId: v.id("competitions"),
    vibMatchKey: v.string(),
    homeTeamId: v.id("footballTeams"),
    awayTeamId: v.id("footballTeams"),
    kickoffAt: v.number(),
    status: v.string(),
    homeGoals: v.optional(v.number()),
    awayGoals: v.optional(v.number()),
    resultText: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_vibMatchKey", ["vibMatchKey"])
    .index("by_competitionId_and_kickoffAt", ["competitionId", "kickoffAt"])
    .index("by_homeTeamId_and_kickoffAt", ["homeTeamId", "kickoffAt"])
    .index("by_awayTeamId_and_kickoffAt", ["awayTeamId", "kickoffAt"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoImageUrl: v.optional(v.string()),
    footballTeamId: v.id("footballTeams"),
    createdByUserId: v.string(),
    createdAt: v.number(),
    plan: v.optional(planTierValidator),
    subscriptionStatus: v.optional(subscriptionStatusValidator),
    stripeCustomerId: v.optional(v.string()),
    billingSyncedAt: v.optional(v.number()),
    billingOnboardingCompletedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_footballTeamId", ["footballTeamId"]),

  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(),
    email: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_organizationId", ["organizationId"]),

  organizationInvitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    invitedByUserId: v.string(),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("cancelled"),
    ),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_email_and_status", ["email", "status"])
    .index("by_organizationId_and_status", ["organizationId", "status"]),

  organizationAutomations: defineTable({
    organizationId: v.id("organizations"),
    automationType: automationTypeValidator,
    isGloballyEnabled: v.boolean(),
    postingChannels: postingChannelStatusesValidator,
    updatedAt: v.number(),
    updatedByUserId: v.optional(v.string()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_automationType", [
      "organizationId",
      "automationType",
    ]),

  automationTemplates: defineTable({
    organizationId: v.id("organizations"),
    automationType: automationTypeValidator,
    name: v.string(),
    sceneDocument: v.any(),
    canvasPreset: canvasPresetValidator,
    schemaVersion: v.number(),
    thumbnailStorageId: v.optional(v.id("_storage")),
    lastRenderPreviewStorageId: v.optional(v.id("_storage")),
    createdByUserId: v.string(),
    updatedByUserId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_automationType", [
      "organizationId",
      "automationType",
    ]),

  templateAssets: defineTable({
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
    pixelWidth: v.optional(v.number()),
    pixelHeight: v.optional(v.number()),
    uploadedByUserId: v.string(),
    createdAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_storageId", ["storageId"]),

  veoPostJobs: defineTable({
    organizationId: v.id("organizations"),
    createdByUserId: v.string(),
    veoMatchSlug: v.string(),
    veoMatchUrl: v.string(),
    veoMatchTitle: v.optional(v.string()),
    veoClubName: v.optional(v.string()),
    veoOpponentName: v.optional(v.string()),
    veoScoreOwn: v.optional(v.number()),
    veoScoreOpponent: v.optional(v.number()),
    draftCaption: v.optional(v.string()),
    postingChannels: postingChannelStatusesValidator,
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    goalCount: v.optional(v.number()),
    goalStartsSeconds: v.optional(v.array(v.number())),
    goalHighlightIds: v.optional(v.array(v.string())),
    warningMessage: v.optional(v.string()),
    vgffmpegJobId: v.optional(v.string()),
    outputR2Key: v.optional(v.string()),
    outputByteSize: v.optional(v.number()),
    outputDurationSeconds: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_createdAt", ["organizationId", "createdAt"])
    .index("by_organizationId_and_veoMatchSlug", [
      "organizationId",
      "veoMatchSlug",
    ])
    .index("by_vgffmpegJobId", ["vgffmpegJobId"])
    .index("by_expiresAt", ["expiresAt"]),
});

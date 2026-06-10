import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  automationTypeValidator,
  canvasPresetValidator,
  postingChannelStatusesValidator,
} from "./automations/validators";
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

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logoImageUrl: v.optional(v.string()),
    createdByUserId: v.string(),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

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
});

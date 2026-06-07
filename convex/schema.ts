import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
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
    joinedAt: v.number(),
  })
    .index("by_userId", ["userId"])
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
});

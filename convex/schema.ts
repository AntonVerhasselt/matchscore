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
});

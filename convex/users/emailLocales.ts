import { v } from "convex/values";
import { internalQuery, mutation } from "../_generated/server";
import { defaultEmailLocale, localeValidator } from "../locales";
import { normalizeEmail } from "../lib/email";

export const setEmailLocaleForAddress = mutation({
  args: {
    email: v.string(),
    locale: localeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const existing = await ctx.db
      .query("pendingEmailLocales")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { locale: args.locale });
    } else {
      await ctx.db.insert("pendingEmailLocales", {
        email: normalizedEmail,
        locale: args.locale,
      });
    }

    return null;
  },
});

export const getLocaleForEmail = internalQuery({
  args: {
    email: v.string(),
  },
  returns: localeValidator,
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("pendingEmailLocales")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.email)))
      .unique();

    return pending?.locale ?? defaultEmailLocale;
  },
});

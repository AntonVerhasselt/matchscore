import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { defaultEmailLocale, localeValidator } from "./locales";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const getUserLocale = query({
  args: {},
  returns: v.union(localeValidator, v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    return settings?.locale ?? null;
  },
});

export const updateUserLocale = mutation({
  args: {
    locale: localeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { locale: args.locale });
    } else {
      await ctx.db.insert("userSettings", {
        userId: user._id,
        locale: args.locale,
      });
    }

    return null;
  },
});

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

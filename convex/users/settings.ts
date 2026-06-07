import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { authComponent } from "../auth/instance";
import { localeValidator } from "../locales";

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

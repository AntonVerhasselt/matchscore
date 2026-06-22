import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { SubscriptionStatus } from "./types";
import type { PaidPlanTier } from "./stripeCatalog";
import {
  planTierValidator,
  subscriptionStatusValidator,
} from "./validators";

export const setStripeCustomerId = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    stripeCustomerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    await ctx.db.patch(args.organizationId, {
      stripeCustomerId: args.stripeCustomerId,
    });

    return null;
  },
});

export const syncOrganizationBilling = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    plan: v.optional(planTierValidator),
    subscriptionStatus: subscriptionStatusValidator,
    subscriptionCancelAtPeriodEnd: v.optional(v.boolean()),
    stripeCustomerId: v.optional(v.string()),
    markOnboardingComplete: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    const patch: {
      subscriptionStatus: SubscriptionStatus;
      billingSyncedAt: number;
      plan?: PaidPlanTier;
      subscriptionCancelAtPeriodEnd?: boolean;
      stripeCustomerId?: string;
      billingOnboardingCompletedAt?: number;
    } = {
      subscriptionStatus: args.subscriptionStatus,
      billingSyncedAt: Date.now(),
    };

    if (args.subscriptionCancelAtPeriodEnd !== undefined) {
      patch.subscriptionCancelAtPeriodEnd = args.subscriptionCancelAtPeriodEnd;
    }

    if (args.plan !== undefined) {
      patch.plan = args.plan;
    }

    if (args.stripeCustomerId) {
      patch.stripeCustomerId = args.stripeCustomerId;
    }

    if (args.markOnboardingComplete) {
      patch.billingOnboardingCompletedAt = Date.now();
    }

    await ctx.db.patch(args.organizationId, patch);
    return null;
  },
});

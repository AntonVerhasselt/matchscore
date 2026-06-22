import { ConvexError, v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { requireCurrentMembership } from "../automations/helpers";
import { requireOrgFeature } from "./access";
import type { PlanTier } from "./types";
import {
  featureKeyValidator,
  subscriptionPlanTierValidator,
} from "./validators";

const checkoutContextValidator = v.object({
  organizationId: v.id("organizations"),
  organizationName: v.string(),
  stripeCustomerId: v.union(v.string(), v.null()),
  plan: v.union(
    v.literal("none"),
    v.literal("minimum"),
    v.literal("pro"),
    v.literal("elite"),
    v.literal("lifetime"),
  ),
  subscriptionStatus: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("canceled"),
    v.literal("none"),
  ),
  userEmail: v.string(),
  userName: v.union(v.string(), v.null()),
});

export const getCheckoutContext = internalQuery({
  args: {
    subscriptionTier: v.optional(subscriptionPlanTierValidator),
  },
  returns: checkoutContextValidator,
  handler: async (ctx, args) => {
    const { user, membership } = await requireCurrentMembership(ctx);
    const organization = await ctx.db.get(membership.organizationId);

    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    if (organization.billingOnboardingCompletedAt != null) {
      const plan = organization.plan ?? "none";
      if (plan !== "none") {
        throw new ConvexError("Billing onboarding is already complete");
      }
    }

    if (args.subscriptionTier) {
      const plan = organization.plan ?? "none";
      const status = organization.subscriptionStatus ?? "none";
      if (plan !== "none" && status === "active") {
        throw new ConvexError("Your club already has an active subscription");
      }
    }

    const plan: PlanTier = organization.plan ?? "none";

    return {
      organizationId: organization._id,
      organizationName: organization.name,
      stripeCustomerId: organization.stripeCustomerId ?? null,
      plan,
      subscriptionStatus: organization.subscriptionStatus ?? "none",
      userEmail: user.email,
      userName: user.name ?? null,
    };
  },
});

export const getOrganizationIdByStripeCustomerId = internalQuery({
  args: {
    stripeCustomerId: v.string(),
  },
  returns: v.union(v.id("organizations"), v.null()),
  handler: async (ctx, args) => {
    const organization = await ctx.db
      .query("organizations")
      .withIndex("by_stripeCustomerId", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .unique();

    return organization?._id ?? null;
  },
});

export const getPortalContext = internalQuery({
  args: {},
  returns: v.object({
    organizationId: v.id("organizations"),
    organizationName: v.string(),
    stripeCustomerId: v.union(v.string(), v.null()),
    userEmail: v.string(),
    userName: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const { user, membership } = await requireCurrentMembership(ctx);
    const organization = await ctx.db.get(membership.organizationId);

    if (!organization) {
      throw new ConvexError("Organization not found");
    }

    if (organization.billingOnboardingCompletedAt == null) {
      throw new ConvexError("Complete onboarding before managing billing");
    }

    return {
      organizationId: organization._id,
      organizationName: organization.name,
      stripeCustomerId: organization.stripeCustomerId ?? null,
      userEmail: user.email,
      userName: user.name ?? null,
    };
  },
});

export const assertCurrentOrgFeature = internalQuery({
  args: {
    feature: featureKeyValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    await requireOrgFeature(ctx, membership.organizationId, args.feature);
    return null;
  },
});

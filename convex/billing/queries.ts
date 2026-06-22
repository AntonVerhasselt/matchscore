import { v } from "convex/values";
import { query } from "../_generated/server";
import { components } from "../_generated/api";
import { authComponent } from "../auth/instance";
import { getOrgFeatureAccess } from "../lib/features";
import { getMembershipForUser } from "../organizations/helpers";
import { getStripeCatalogMode } from "./stripeCatalog";
import type { PlanTier } from "./types";
import {
  featureAccessValidator,
  planTierValidator,
  stripeSubscriptionSnapshotValidator,
  subscriptionStatusValidator,
} from "./validators";

export const getOrgBillingState = query({
  args: {},
  returns: v.union(
    v.object({
      organizationId: v.id("organizations"),
      plan: v.union(planTierValidator, v.literal("none")),
      subscriptionStatus: subscriptionStatusValidator,
      stripeCustomerId: v.union(v.string(), v.null()),
      billingSyncedAt: v.union(v.number(), v.null()),
      stripeCatalogMode: v.union(v.literal("test"), v.literal("live")),
      stripeSubscription: v.union(stripeSubscriptionSnapshotValidator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const membership = await getMembershipForUser(ctx, user._id);
    if (!membership) {
      return null;
    }

    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      return null;
    }

    const stripeSubscription = await ctx.runQuery(
      components.stripe.public.getSubscriptionByOrgId,
      { orgId: organization._id },
    );

    const plan: PlanTier = organization.plan ?? "none";

    return {
      organizationId: organization._id,
      plan,
      subscriptionStatus: organization.subscriptionStatus ?? "none",
      stripeCustomerId: organization.stripeCustomerId ?? null,
      billingSyncedAt: organization.billingSyncedAt ?? null,
      stripeCatalogMode: getStripeCatalogMode(),
      stripeSubscription: stripeSubscription
        ? {
            stripeSubscriptionId: stripeSubscription.stripeSubscriptionId,
            stripeCustomerId: stripeSubscription.stripeCustomerId,
            status: stripeSubscription.status,
            priceId: stripeSubscription.priceId,
            currentPeriodEnd: stripeSubscription.currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancelAtPeriodEnd,
          }
        : null,
    };
  },
});

export const getOrgFeatures = query({
  args: {},
  returns: v.union(featureAccessValidator, v.null()),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return null;
    }

    const membership = await getMembershipForUser(ctx, user._id);
    if (!membership) {
      return null;
    }

    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      return null;
    }

    return getOrgFeatureAccess({
      plan: organization.plan ?? "none",
      subscriptionStatus: organization.subscriptionStatus ?? "none",
    });
  },
});

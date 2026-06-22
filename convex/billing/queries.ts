import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { authComponent } from "../auth/instance";
import {
  getAutomationsPostBlockReason,
  getGoalHighlightsBlockReason,
} from "./access";
import { getOrgFeatureAccess } from "../lib/features";
import { getMembershipForUser } from "../organizations/helpers";
import { getStripeCatalogMode } from "./stripeCatalog";
import type { PlanTier } from "./types";
import type { SubscriptionStatus } from "./types";
import {
  featureAccessValidator,
  orgBillingContextValidator,
  planTierValidator,
  stripeSubscriptionSnapshotValidator,
  subscriptionStatusValidator,
} from "./validators";
import { planDisplayPricing } from "./stripeCatalog";

async function loadOrgBillingFieldsForCurrentUser(ctx: QueryCtx) {
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

  const plan: PlanTier = organization.plan ?? "none";
  const subscriptionStatus: SubscriptionStatus =
    organization.subscriptionStatus ?? "none";

  return {
    organization,
    plan,
    subscriptionStatus,
  };
}

export const getOrgBillingState = query({
  args: {},
  returns: v.union(
    v.object({
      organizationId: v.id("organizations"),
      plan: v.union(planTierValidator, v.literal("none")),
      subscriptionStatus: subscriptionStatusValidator,
      subscriptionCancelAtPeriodEnd: v.boolean(),
      stripeCustomerId: v.union(v.string(), v.null()),
      billingSyncedAt: v.union(v.number(), v.null()),
      billingOnboardingCompletedAt: v.union(v.number(), v.null()),
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
      subscriptionCancelAtPeriodEnd:
        (organization.subscriptionCancelAtPeriodEnd ?? false) ||
        (stripeSubscription?.cancelAtPeriodEnd ?? false),
      stripeCustomerId: organization.stripeCustomerId ?? null,
      billingSyncedAt: organization.billingSyncedAt ?? null,
      billingOnboardingCompletedAt:
        organization.billingOnboardingCompletedAt ?? null,
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

export const getOrgBillingContext = query({
  args: {},
  returns: v.union(orgBillingContextValidator, v.null()),
  handler: async (ctx) => {
    const billing = await loadOrgBillingFieldsForCurrentUser(ctx);
    if (!billing) {
      return null;
    }

    const features = getOrgFeatureAccess({
      plan: billing.plan,
      subscriptionStatus: billing.subscriptionStatus,
    });

    return {
      plan: billing.plan,
      subscriptionStatus: billing.subscriptionStatus,
      features,
      goalHighlightsBlockReason: getGoalHighlightsBlockReason({
        plan: billing.plan,
        subscriptionStatus: billing.subscriptionStatus,
      }),
      automationsPostBlockReason: getAutomationsPostBlockReason({
        plan: billing.plan,
        subscriptionStatus: billing.subscriptionStatus,
      }),
    };
  },
});

export const getOrgFeatures = query({
  args: {},
  returns: v.union(featureAccessValidator, v.null()),
  handler: async (ctx) => {
    const context = await loadOrgBillingFieldsForCurrentUser(ctx);
    if (!context) {
      return null;
    }

    return getOrgFeatureAccess({
      plan: context.plan,
      subscriptionStatus: context.subscriptionStatus,
    });
  },
});

export const needsBillingOnboarding = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) {
      return false;
    }

    const membership = await getMembershipForUser(ctx, user._id);
    if (!membership) {
      return false;
    }

    const organization = await ctx.db.get(membership.organizationId);
    if (!organization) {
      return false;
    }

    return organization.billingOnboardingCompletedAt == null;
  },
});

export const needsPlanSelection = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const loaded = await loadOrgBillingFieldsForCurrentUser(ctx);
    if (!loaded) {
      return false;
    }

    return loaded.plan === "none";
  },
});

const onboardingPlanOptionValidator = v.object({
  tier: planTierValidator,
  monthlyPriceEuros: v.union(v.number(), v.null()),
  yearlyPriceEuros: v.union(v.number(), v.null()),
  oneTimePriceEuros: v.union(v.number(), v.null()),
});

export const getOnboardingPlanOptions = query({
  args: {},
  returns: v.array(onboardingPlanOptionValidator),
  handler: async () => {
    return (
      [
        "minimum",
        "pro",
        "elite",
        "lifetime",
      ] as const
    ).map((tier) => {
      const pricing = planDisplayPricing[tier];
      if ("oneTimeEuros" in pricing) {
        return {
          tier,
          monthlyPriceEuros: null,
          yearlyPriceEuros: null,
          oneTimePriceEuros: pricing.oneTimeEuros,
        };
      }

      return {
        tier,
        monthlyPriceEuros: pricing.monthlyEuros,
        yearlyPriceEuros: pricing.yearlyEuros,
        oneTimePriceEuros: null,
      };
    });
  },
});

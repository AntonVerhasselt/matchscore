import type { PlanTier, SubscriptionStatus } from "../billing/types";

export const Feature = {
  AutomationsEdit: "automations:edit",
  AutomationsPost: "automations:post",
  GoalHighlightsGenerate: "goal_highlights:generate",
  ApplyWatermark: "automations:watermark",
} as const;

export type FeatureKey = (typeof Feature)[keyof typeof Feature];

export type FeatureAccess = {
  automationsEdit: boolean;
  automationsPost: boolean;
  goalHighlightsGenerate: boolean;
  automationsWatermark: boolean;
};

export type OrgBillingFields = {
  plan?: PlanTier;
  subscriptionStatus?: SubscriptionStatus;
};

export type FeatureBlockReason =
  | "upgrade_required"
  | "subscription_inactive";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active"];

function isBillingActive(
  tier: PlanTier,
  status: SubscriptionStatus | undefined,
): boolean {
  if (tier === "lifetime") {
    return true;
  }
  if (tier === "none") {
    return false;
  }
  return status !== undefined && ACTIVE_STATUSES.includes(status);
}

export function resolvePlanTier(org: OrgBillingFields): PlanTier {
  return org.plan ?? "none";
}

export function resolveSubscriptionStatus(
  org: OrgBillingFields,
): SubscriptionStatus {
  return org.subscriptionStatus ?? "none";
}

export function hasFeature(
  tier: PlanTier,
  status: SubscriptionStatus | undefined,
  feature: FeatureKey,
): boolean {
  const billingActive = isBillingActive(tier, status);

  switch (feature) {
    case Feature.AutomationsEdit:
      return true;
    case Feature.AutomationsPost:
      return billingActive && tier !== "none";
    case Feature.GoalHighlightsGenerate:
      return (
        billingActive && (tier === "elite" || tier === "lifetime")
      );
    case Feature.ApplyWatermark:
      return billingActive && tier === "minimum";
    default: {
      const _exhaustive: never = feature;
      return _exhaustive;
    }
  }
}

export function getOrgFeatureAccess(org: OrgBillingFields): FeatureAccess {
  const tier = resolvePlanTier(org);
  const status = org.subscriptionStatus;

  return {
    automationsEdit: hasFeature(tier, status, Feature.AutomationsEdit),
    automationsPost: hasFeature(tier, status, Feature.AutomationsPost),
    goalHighlightsGenerate: hasFeature(
      tier,
      status,
      Feature.GoalHighlightsGenerate,
    ),
    automationsWatermark: hasFeature(tier, status, Feature.ApplyWatermark),
  };
}

export function getFeatureBlockReason(
  org: OrgBillingFields,
  feature: FeatureKey,
): FeatureBlockReason | null {
  const tier = resolvePlanTier(org);
  const status = resolveSubscriptionStatus(org);

  if (hasFeature(tier, status, feature)) {
    return null;
  }

  if (
    tier !== "none" &&
    tier !== "lifetime" &&
    (status === "past_due" || status === "canceled")
  ) {
    return "subscription_inactive";
  }

  return "upgrade_required";
}

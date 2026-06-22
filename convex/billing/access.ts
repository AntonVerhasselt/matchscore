import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  Feature,
  getFeatureBlockReason,
  hasFeature,
  resolvePlanTier,
  resolveSubscriptionStatus,
  type FeatureKey,
  type OrgBillingFields,
} from "../lib/features";
import {
  featureLockedErrorData,
} from "../../lib/goal-highlights/errors";

type BillingAccessCtx = QueryCtx | MutationCtx;

function getOrgBillingFields(organization: {
  plan?: OrgBillingFields["plan"];
  subscriptionStatus?: OrgBillingFields["subscriptionStatus"];
}): OrgBillingFields {
  return {
    plan: organization.plan,
    subscriptionStatus: organization.subscriptionStatus,
  };
}

export async function requireOrgFeature(
  ctx: BillingAccessCtx,
  organizationId: Id<"organizations">,
  feature: FeatureKey,
): Promise<void> {
  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization) {
    throw new ConvexError("Organization not found");
  }

  const billingFields = getOrgBillingFields(organization);
  const plan = resolvePlanTier(billingFields);
  const subscriptionStatus = resolveSubscriptionStatus(billingFields);

  if (hasFeature(plan, subscriptionStatus, feature)) {
    return;
  }

  const blockReason =
    getFeatureBlockReason(billingFields, feature) ?? "upgrade_required";

  throw new ConvexError(featureLockedErrorData(blockReason));
}

export function getGoalHighlightsBlockReason(org: {
  plan?: ReturnType<typeof resolvePlanTier>;
  subscriptionStatus?: ReturnType<typeof resolveSubscriptionStatus>;
}) {
  return getFeatureBlockReason(
    {
      plan: org.plan ?? "none",
      subscriptionStatus: org.subscriptionStatus ?? "none",
    },
    Feature.GoalHighlightsGenerate,
  );
}

export function getAutomationsPostBlockReason(org: {
  plan?: ReturnType<typeof resolvePlanTier>;
  subscriptionStatus?: ReturnType<typeof resolveSubscriptionStatus>;
}) {
  return getFeatureBlockReason(
    {
      plan: org.plan ?? "none",
      subscriptionStatus: org.subscriptionStatus ?? "none",
    },
    Feature.AutomationsPost,
  );
}

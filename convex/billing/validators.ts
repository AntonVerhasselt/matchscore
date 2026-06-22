import { v } from "convex/values";

export const planTierValidator = v.union(
  v.literal("minimum"),
  v.literal("pro"),
  v.literal("elite"),
  v.literal("lifetime"),
);

export const subscriptionPlanTierValidator = v.union(
  v.literal("minimum"),
  v.literal("pro"),
  v.literal("elite"),
);

export const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("none"),
);

export const stripeSubscriptionSnapshotValidator = v.object({
  stripeSubscriptionId: v.string(),
  stripeCustomerId: v.string(),
  status: v.string(),
  priceId: v.string(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
});

export const featureAccessValidator = v.object({
  automationsEdit: v.boolean(),
  automationsPost: v.boolean(),
  goalHighlightsGenerate: v.boolean(),
  automationsWatermark: v.boolean(),
});

export const featureBlockReasonValidator = v.union(
  v.literal("upgrade_required"),
  v.literal("subscription_inactive"),
);

export const featureKeyValidator = v.union(
  v.literal("automations:edit"),
  v.literal("automations:post"),
  v.literal("goal_highlights:generate"),
  v.literal("automations:watermark"),
);

export const orgBillingContextValidator = v.object({
  plan: v.union(planTierValidator, v.literal("none")),
  subscriptionStatus: subscriptionStatusValidator,
  features: featureAccessValidator,
  goalHighlightsBlockReason: v.union(featureBlockReasonValidator, v.null()),
  automationsPostBlockReason: v.union(featureBlockReasonValidator, v.null()),
});

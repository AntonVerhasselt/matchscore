import { v } from "convex/values";

export const planTierValidator = v.union(
  v.literal("minimum"),
  v.literal("pro"),
  v.literal("elite"),
  v.literal("lifetime"),
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

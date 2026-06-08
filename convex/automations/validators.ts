import { v } from "convex/values";

export const automationTypeValidator = v.union(
  v.literal("match_announcement"),
  v.literal("match_result"),
);

export const canvasPresetValidator = v.union(
  v.literal("instagram_square"),
  v.literal("instagram_portrait"),
  v.literal("facebook_landscape"),
);

export const postingChannelValidator = v.union(
  v.literal("facebookPagePost"),
  v.literal("facebookPageStory"),
  v.literal("instagramProfilePost"),
  v.literal("instagramProfileStory"),
);

export const postingChannelStatusesValidator = v.object({
  facebookPagePost: v.boolean(),
  facebookPageStory: v.boolean(),
  instagramProfilePost: v.boolean(),
  instagramProfileStory: v.boolean(),
});

export const automationTemplateSummaryValidator = v.object({
  _id: v.id("automationTemplates"),
  name: v.string(),
  automationType: automationTypeValidator,
  canvasPreset: canvasPresetValidator,
  schemaVersion: v.number(),
  updatedAt: v.number(),
});

export const automationTemplateDetailValidator = v.object({
  _id: v.id("automationTemplates"),
  name: v.string(),
  automationType: automationTypeValidator,
  canvasPreset: canvasPresetValidator,
  schemaVersion: v.number(),
  sceneDocument: v.any(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

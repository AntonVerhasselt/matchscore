import { v } from "convex/values";
import {
  AUTOMATION_TYPES,
  CANVAS_PRESETS,
  POSTING_CHANNELS,
} from "./constants";

export const automationTypeValidator = v.union(
  v.literal(AUTOMATION_TYPES[0]),
  v.literal(AUTOMATION_TYPES[1]),
);

export const canvasPresetValidator = v.union(
  v.literal(CANVAS_PRESETS[0]),
  v.literal(CANVAS_PRESETS[1]),
  v.literal(CANVAS_PRESETS[2]),
);

export const postingChannelValidator = v.union(
  v.literal(POSTING_CHANNELS[0]),
  v.literal(POSTING_CHANNELS[1]),
  v.literal(POSTING_CHANNELS[2]),
  v.literal(POSTING_CHANNELS[3]),
);

export const postingChannelStatusesValidator = v.object({
  [POSTING_CHANNELS[0]]: v.boolean(),
  [POSTING_CHANNELS[1]]: v.boolean(),
  [POSTING_CHANNELS[2]]: v.boolean(),
  [POSTING_CHANNELS[3]]: v.boolean(),
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

import { v } from "convex/values";

import { internalQuery } from "../_generated/server";
import {
  automationTypeValidator,
  canvasPresetValidator,
} from "./validators";

export const getTemplateForThumbnail = internalQuery({
  args: {
    templateId: v.id("automationTemplates"),
  },
  returns: v.union(
    v.object({
      organizationId: v.id("organizations"),
      automationType: automationTypeValidator,
      canvasPreset: canvasPresetValidator,
      sceneDocument: v.any(),
      thumbnailStorageId: v.optional(v.id("_storage")),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return null;
    }

    return {
      organizationId: template.organizationId,
      automationType: template.automationType,
      canvasPreset: template.canvasPreset,
      sceneDocument: template.sceneDocument,
      thumbnailStorageId: template.thumbnailStorageId,
      updatedAt: template.updatedAt,
    };
  },
});

import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

/** Replaces the stored render-test preview for a template and deletes the previous blob. */
export const replaceTemplateRenderPreview = internalMutation({
  args: {
    templateId: v.id("automationTemplates"),
    newStorageId: v.id("_storage"),
    previousStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return null;
    }

    const previousStorageId =
      args.previousStorageId ?? template.lastRenderPreviewStorageId;

    if (
      previousStorageId &&
      previousStorageId !== args.newStorageId
    ) {
      await ctx.storage.delete(previousStorageId);
    }

    await ctx.db.patch(args.templateId, {
      lastRenderPreviewStorageId: args.newStorageId,
    });

    return null;
  },
});

/** Replaces the stored list thumbnail for a template and deletes the previous blob. */
export const replaceTemplateThumbnail = internalMutation({
  args: {
    templateId: v.id("automationTemplates"),
    newStorageId: v.id("_storage"),
    previousStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      return null;
    }

    const previousStorageId = template.thumbnailStorageId;

    if (previousStorageId && previousStorageId !== args.newStorageId) {
      await ctx.storage.delete(previousStorageId);
    }

    await ctx.db.patch(args.templateId, {
      thumbnailStorageId: args.newStorageId,
    });

    return null;
  },
});

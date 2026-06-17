"use node";

import { ConvexError, v } from "convex/values";

import { api, internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import { normalizeSceneDocument } from "../../lib/template-scene";
import {
  renderTemplateSceneToPngBuffer,
  renderTemplateSceneToThumbnailBuffer,
  resolveTemplateRenderMatch,
} from "./render/run_template_render";
import { renderSolidColorSpikePng } from "./render/render_template_to_png";

export const renderTemplateTest = action({
  args: {
    templateId: v.id("automationTemplates"),
    sceneDocument: v.optional(v.any()),
  },
  returns: v.object({
    storageId: v.id("_storage"),
    previewUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const template = await ctx.runQuery(api.automations.queries.getTemplate, {
      templateId: args.templateId,
    });

    if (!template) {
      throw new ConvexError("Template not found");
    }

    const rawSceneDocument = args.sceneDocument ?? template.sceneDocument;
    let sceneDocument;
    try {
      sceneDocument = normalizeSceneDocument(
        rawSceneDocument,
        template.canvasPreset,
        template.automationType,
      );
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Invalid scene document",
      );
    }

    await ctx.runQuery(
      api.templateAssets.queries.assertSceneDocumentAssetReferences,
      { sceneDocument },
    );

    const match = await resolveTemplateRenderMatch(
      ctx,
      template.organizationId,
      template.automationType,
    );

    let pngBuffer: Buffer;
    try {
      pngBuffer = await renderTemplateSceneToPngBuffer(
        ctx,
        {
          organizationId: template.organizationId,
          automationType: template.automationType,
          canvasPreset: template.canvasPreset,
          sceneDocument,
          purpose: "render-test",
        },
        match,
      );
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Template render failed",
      );
    }

    const storageId = await ctx.storage.store(
      new Blob([Uint8Array.from(pngBuffer)], { type: "image/png" }),
    );

    try {
      await ctx.runMutation(
        internal.automations.internalMutations.replaceTemplateRenderPreview,
        {
          templateId: args.templateId,
          newStorageId: storageId,
          previousStorageId: template.lastRenderPreviewStorageId,
        },
      );
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }

    const previewUrl = await ctx.storage.getUrl(storageId);
    if (!previewUrl) {
      throw new ConvexError("Failed to generate preview URL");
    }

    return { storageId, previewUrl };
  },
});

export const generateTemplateThumbnail = internalAction({
  args: {
    templateId: v.id("automationTemplates"),
    expectedUpdatedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const template = await ctx.runQuery(
      internal.automations.internalQueries.getTemplateForThumbnail,
      { templateId: args.templateId },
    );

    if (!template || template.updatedAt !== args.expectedUpdatedAt) {
      console.log("[template-thumbnail] Skipping stale thumbnail job", {
        templateId: args.templateId,
        expectedUpdatedAt: args.expectedUpdatedAt,
        currentUpdatedAt: template?.updatedAt ?? null,
      });
      return null;
    }

    console.log("[template-thumbnail] Starting thumbnail generation", {
      templateId: args.templateId,
      expectedUpdatedAt: args.expectedUpdatedAt,
      organizationId: template.organizationId,
      hasExistingThumbnail: Boolean(template.thumbnailStorageId),
    });

    let sceneDocument;
    try {
      sceneDocument = normalizeSceneDocument(
        template.sceneDocument,
        template.canvasPreset,
        template.automationType,
      );
    } catch (error) {
      console.error("Template thumbnail generation skipped: invalid scene", {
        templateId: args.templateId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }

    const match = await resolveTemplateRenderMatch(
      ctx,
      template.organizationId,
      template.automationType,
    );

    let jpegBuffer: Buffer;
    try {
      jpegBuffer = await renderTemplateSceneToThumbnailBuffer(
        ctx,
        {
          organizationId: template.organizationId,
          automationType: template.automationType,
          canvasPreset: template.canvasPreset,
          sceneDocument,
          purpose: "list-thumbnail",
        },
        match,
      );
    } catch (error) {
      console.error("Template thumbnail generation failed", {
        templateId: args.templateId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }

    const storageId = await ctx.storage.store(
      new Blob([Uint8Array.from(jpegBuffer)], { type: "image/jpeg" }),
    );

    try {
      await ctx.runMutation(
        internal.automations.internalMutations.replaceTemplateThumbnail,
        {
          templateId: args.templateId,
          newStorageId: storageId,
          previousStorageId: template.thumbnailStorageId,
        },
      );
      console.log("[template-thumbnail] Thumbnail stored", {
        templateId: args.templateId,
        storageId,
        byteLength: jpegBuffer.byteLength,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      console.error("Template thumbnail storage update failed", {
        templateId: args.templateId,
        error: error instanceof Error ? error.message : error,
      });
    }

    return null;
  },
});

/** Internal spike helper — verifies skia-canvas runs in Convex Node actions. */
export const renderSpikeTest = internalAction({
  args: {},
  returns: v.object({
    storageId: v.id("_storage"),
    previewUrl: v.string(),
  }),
  handler: async (ctx) => {
    const pngBuffer = await renderSolidColorSpikePng(100, 100, "#dc2626");
    const storageId = await ctx.storage.store(
      new Blob([Uint8Array.from(pngBuffer)], { type: "image/png" }),
    );
    const previewUrl = await ctx.storage.getUrl(storageId);
    if (!previewUrl) {
      throw new ConvexError("Failed to generate preview URL");
    }

    return { storageId, previewUrl };
  },
});

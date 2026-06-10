"use node";

import { ConvexError, v } from "convex/values";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import { DEFAULT_MOCK_MATCH } from "../../lib/template-scene/mock-match";
import { normalizeSceneDocument } from "../../lib/template-scene";
import {
  renderSolidColorSpikePng,
  renderTemplateToPng,
} from "./render/render_template_to_png";

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

    const assets = await ctx.runQuery(api.templateAssets.queries.listTemplateAssets, {});
    const storageIdByAssetId = new Map<Id<"templateAssets">, Id<"_storage">>(
      assets.map((asset) => [asset._id, asset.storageId]),
    );

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

    let pngBuffer: Buffer;
    try {
      pngBuffer = await renderTemplateToPng({
        sceneDocument,
        automationType: template.automationType,
        canvasPreset: template.canvasPreset,
        match: DEFAULT_MOCK_MATCH,
        loaders: {
          loadAsset: async (assetId) => {
            const storageId = storageIdByAssetId.get(
              assetId as Id<"templateAssets">,
            );
            if (!storageId) {
              return null;
            }

            const blob = await ctx.storage.get(storageId);
            if (!blob) {
              return null;
            }

            return Buffer.from(await blob.arrayBuffer());
          },
        },
      });
    } catch (error) {
      throw new ConvexError(
        error instanceof Error ? error.message : "Template render failed",
      );
    }

    const storageId = await ctx.storage.store(
      new Blob([Uint8Array.from(pngBuffer)], { type: "image/png" }),
    );

    await ctx.runMutation(
      internal.automations.internalMutations.replaceTemplateRenderPreview,
      {
        templateId: args.templateId,
        newStorageId: storageId,
        previousStorageId: template.lastRenderPreviewStorageId,
      },
    );

    const previewUrl = await ctx.storage.getUrl(storageId);
    if (!previewUrl) {
      throw new ConvexError("Failed to generate preview URL");
    }

    return { storageId, previewUrl };
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

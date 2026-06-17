"use node";

import type { GenericActionCtx } from "convex/server";

import type { DataModel, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { DEFAULT_MOCK_MATCH } from "../../../lib/template-scene/mock-match";
import { normalizeSceneDocument } from "../../../lib/template-scene";
import type { TemplateMatchDto } from "../../../lib/template-scene/template-match";
import {
  renderTemplateToJpegThumbnail,
  renderTemplateToPng,
  type RenderTemplateInput,
} from "./render_template_to_png";
import {
  TEMPLATE_THUMBNAIL_JPEG_QUALITY,
  TEMPLATE_THUMBNAIL_MAX_EDGE_PX,
} from "../thumbnailConstants";

type ActionCtx = GenericActionCtx<DataModel>;

type TemplateRenderSource = {
  organizationId: Id<"organizations">;
  automationType: RenderTemplateInput["automationType"];
  canvasPreset: RenderTemplateInput["canvasPreset"];
  sceneDocument: unknown;
  purpose?: string;
};

async function loadRenderAssetLoaders(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  purpose?: string,
): Promise<RenderTemplateInput["loaders"]> {
  const assets = await ctx.runQuery(
    internal.templateAssets.internalQueries.listAssetStorageByOrganization,
    { organizationId },
  );
  const storageIdByAssetId = new Map<Id<"templateAssets">, Id<"_storage">>(
    assets.map((asset) => [asset._id, asset.storageId]),
  );

  console.log("[template-render] Loaded template assets for organization", {
    purpose,
    organizationId,
    assetCount: assets.length,
    assetIds: assets.map((asset) => asset._id),
  });

  return {
    loadAsset: async (assetId) => {
      const storageId = storageIdByAssetId.get(assetId as Id<"templateAssets">);
      if (!storageId) {
        console.warn("[template-render] Template asset id not found for org", {
          purpose,
          organizationId,
          assetId,
        });
        return null;
      }

      const blob = await ctx.storage.get(storageId);
      if (!blob) {
        console.warn("[template-render] Storage blob missing for template asset", {
          purpose,
          organizationId,
          assetId,
          storageId,
        });
        return null;
      }

      return Buffer.from(await blob.arrayBuffer());
    },
    loadTeamLogo: async (storageId) => {
      const blob = await ctx.storage.get(storageId);
      if (!blob) {
        return null;
      }

      return Buffer.from(await blob.arrayBuffer());
    },
  };
}

async function resolveMatchForOrganization(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  automationType: RenderTemplateInput["automationType"],
): Promise<TemplateMatchDto> {
  const matchData = await ctx.runQuery(
    internal.football.internalQueries.getTemplateRenderMatchForOrganization,
    {
      organizationId,
      automationType,
      now: Date.now(),
    },
  );

  return matchData ?? DEFAULT_MOCK_MATCH;
}

export async function renderTemplateSceneToPngBuffer(
  ctx: ActionCtx,
  source: TemplateRenderSource,
  match: TemplateMatchDto,
): Promise<Buffer> {
  const sceneDocument = normalizeSceneDocument(
    source.sceneDocument,
    source.canvasPreset,
    source.automationType,
  );
  const loaders = await loadRenderAssetLoaders(
    ctx,
    source.organizationId,
    source.purpose,
  );

  return await renderTemplateToPng({
    sceneDocument,
    automationType: source.automationType,
    canvasPreset: source.canvasPreset,
    match,
    loaders,
    purpose: source.purpose,
  });
}

export async function renderTemplateSceneToThumbnailBuffer(
  ctx: ActionCtx,
  source: TemplateRenderSource,
  match: TemplateMatchDto,
): Promise<Buffer> {
  const sceneDocument = normalizeSceneDocument(
    source.sceneDocument,
    source.canvasPreset,
    source.automationType,
  );
  const loaders = await loadRenderAssetLoaders(
    ctx,
    source.organizationId,
    source.purpose,
  );

  return await renderTemplateToJpegThumbnail(
    {
      sceneDocument,
      automationType: source.automationType,
      canvasPreset: source.canvasPreset,
      match,
      loaders,
      purpose: source.purpose,
    },
    {
      maxEdgePx: TEMPLATE_THUMBNAIL_MAX_EDGE_PX,
      quality: TEMPLATE_THUMBNAIL_JPEG_QUALITY,
    },
  );
}

export async function resolveTemplateRenderMatch(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  automationType: RenderTemplateInput["automationType"],
): Promise<TemplateMatchDto> {
  return await resolveMatchForOrganization(ctx, organizationId, automationType);
}

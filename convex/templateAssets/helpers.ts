import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { collectSceneAssetIds } from "../../lib/template-scene";
import {
  ALLOWED_TEMPLATE_ASSET_MIME_TYPES,
  MAX_TEMPLATE_ASSET_BYTE_SIZE,
  type TemplateAssetMimeType,
} from "./constants";

export const TEMPLATE_ASSET_LIST_LIMIT = 100;

export function isAllowedTemplateAssetMimeType(
  mimeType: string | undefined,
): mimeType is TemplateAssetMimeType {
  return (
    typeof mimeType === "string" &&
    ALLOWED_TEMPLATE_ASSET_MIME_TYPES.includes(
      mimeType as TemplateAssetMimeType,
    )
  );
}

export function normalizeTemplateAssetFileName(fileName: string): string {
  return fileName.trim().replace(/\s+/g, " ").slice(0, 240);
}

export async function requireTemplateAsset(
  ctx: QueryCtx | MutationCtx,
  assetId: Id<"templateAssets">,
  organizationId: Id<"organizations">,
): Promise<Doc<"templateAssets">> {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.organizationId !== organizationId) {
    throw new ConvexError("Template asset not found");
  }
  return asset;
}

export async function validateTemplateAssetStorageMetadata(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) {
    throw new ConvexError("Uploaded file not found");
  }

  if (!isAllowedTemplateAssetMimeType(metadata.contentType)) {
    await ctx.storage.delete(storageId);
    throw new ConvexError("Unsupported image type");
  }

  if (metadata.size > MAX_TEMPLATE_ASSET_BYTE_SIZE) {
    await ctx.storage.delete(storageId);
    throw new ConvexError("Image is too large");
  }

  return {
    mimeType: metadata.contentType,
    byteSize: metadata.size,
  };
}

export async function assertTemplateAssetReferencesBelongToOrganization(
  ctx: QueryCtx | MutationCtx,
  sceneDocument: unknown,
  organizationId: Id<"organizations">,
) {
  for (const rawAssetId of collectSceneAssetIds(sceneDocument)) {
    const asset = await ctx.db.get(rawAssetId as Id<"templateAssets">);
    if (!asset || asset.organizationId !== organizationId) {
      throw new ConvexError("Template references an unavailable image asset");
    }
  }
}

export async function findTemplateReferencingAsset(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  assetId: Id<"templateAssets">,
): Promise<Doc<"automationTemplates"> | null> {
  for await (const template of ctx.db
    .query("automationTemplates")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))) {
    if (collectSceneAssetIds(template.sceneDocument).includes(assetId)) {
      return template;
    }
  }

  return null;
}


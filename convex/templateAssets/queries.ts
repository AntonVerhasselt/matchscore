import { v } from "convex/values";

import { query } from "../_generated/server";
import { getCurrentMembershipOrNull } from "../automations/helpers";
import { assertTemplateAssetReferencesBelongToOrganization } from "./helpers";
import { TEMPLATE_ASSET_LIST_LIMIT } from "./helpers";
import { templateAssetValidator } from "./validators";

export const listTemplateAssets = query({
  args: {},
  returns: v.array(templateAssetValidator),
  handler: async (ctx) => {
    const membershipCtx = await getCurrentMembershipOrNull(ctx);
    if (!membershipCtx) {
      return [];
    }
    const { membership } = membershipCtx;
    const assets = await ctx.db
      .query("templateAssets")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", membership.organizationId),
      )
      .order("desc")
      .take(TEMPLATE_ASSET_LIST_LIMIT);

    return await Promise.all(
      assets.map(async (asset) => ({
        _id: asset._id,
        storageId: asset.storageId,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        pixelWidth: asset.pixelWidth ?? null,
        pixelHeight: asset.pixelHeight ?? null,
        createdAt: asset.createdAt,
        url: await ctx.storage.getUrl(asset.storageId),
      })),
    );
  },
});

/** Validates that every assetId in a scene belongs to the caller's organization. */
export const assertSceneDocumentAssetReferences = query({
  args: {
    sceneDocument: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const membershipCtx = await getCurrentMembershipOrNull(ctx);
    if (!membershipCtx) {
      return null;
    }
    const { membership } = membershipCtx;
    await assertTemplateAssetReferencesBelongToOrganization(
      ctx,
      args.sceneDocument,
      membership.organizationId,
    );
    return null;
  },
});


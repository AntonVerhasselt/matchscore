import { query } from "../_generated/server";
import { requireCurrentMembership } from "../automations/helpers";
import { TEMPLATE_ASSET_LIST_LIMIT } from "./helpers";
import { templateAssetValidator } from "./validators";
import { v } from "convex/values";

export const listTemplateAssets = query({
  args: {},
  returns: v.array(templateAssetValidator),
  handler: async (ctx) => {
    const { membership } = await requireCurrentMembership(ctx);
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


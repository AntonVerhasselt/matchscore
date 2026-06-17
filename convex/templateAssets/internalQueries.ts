import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

export const listAssetStorageByOrganization = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("templateAssets"),
      storageId: v.id("_storage"),
    }),
  ),
  handler: async (ctx, args) => {
    const assets = await ctx.db
      .query("templateAssets")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .collect();

    return assets.map((asset) => ({
      _id: asset._id,
      storageId: asset.storageId,
    }));
  },
});

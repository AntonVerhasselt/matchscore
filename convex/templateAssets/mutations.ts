import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireCurrentMembership } from "../automations/helpers";
import {
  findTemplateReferencingAsset,
  normalizeTemplateAssetFileName,
  requireTemplateAsset,
  validateTemplateAssetStorageMetadata,
} from "./helpers";
import { templateAssetValidator } from "./validators";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireCurrentMembership(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveTemplateAsset = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    pixelWidth: v.number(),
    pixelHeight: v.number(),
  },
  returns: templateAssetValidator,
  handler: async (ctx, args) => {
    const { user, membership } = await requireCurrentMembership(ctx);

    const existing = await ctx.db
      .query("templateAssets")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      throw new ConvexError("Uploaded file is already saved");
    }

    const fileName = normalizeTemplateAssetFileName(args.fileName);
    const roundedPixelWidth = Math.round(args.pixelWidth);
    const roundedPixelHeight = Math.round(args.pixelHeight);
    if (!fileName) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError("File name is required");
    }
    if (
      !Number.isFinite(roundedPixelWidth) ||
      !Number.isFinite(roundedPixelHeight) ||
      roundedPixelWidth <= 0 ||
      roundedPixelHeight <= 0
    ) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError("Image dimensions are required");
    }

    const metadata = await validateTemplateAssetStorageMetadata(ctx, args.storageId);
    const now = Date.now();
    const assetId = await ctx.db.insert("templateAssets", {
      organizationId: membership.organizationId,
      storageId: args.storageId,
      fileName,
      mimeType: metadata.mimeType,
      byteSize: metadata.byteSize,
      pixelWidth: roundedPixelWidth,
      pixelHeight: roundedPixelHeight,
      uploadedByUserId: user._id,
      createdAt: now,
    });

    return {
      _id: assetId,
      storageId: args.storageId,
      fileName,
      mimeType: metadata.mimeType,
      byteSize: metadata.byteSize,
      pixelWidth: roundedPixelWidth,
      pixelHeight: roundedPixelHeight,
      createdAt: now,
      url: await ctx.storage.getUrl(args.storageId),
    };
  },
});

export const deleteTemplateAsset = mutation({
  args: {
    assetId: v.id("templateAssets"),
  },
  returns: v.union(
    v.object({ status: v.literal("deleted") }),
    v.object({ status: v.literal("inUse") }),
  ),
  handler: async (ctx, args) => {
    const { membership } = await requireCurrentMembership(ctx);
    const asset = await requireTemplateAsset(
      ctx,
      args.assetId,
      membership.organizationId,
    );
    const referencingTemplate = await findTemplateReferencingAsset(
      ctx,
      membership.organizationId,
      asset._id,
    );

    if (referencingTemplate) {
      return { status: "inUse" } as const;
    }

    await ctx.storage.delete(asset.storageId);
    await ctx.db.delete(asset._id);
    return { status: "deleted" } as const;
  },
});


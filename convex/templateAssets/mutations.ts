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
    if (!fileName) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError("File name is required");
    }
    if (
      !Number.isFinite(args.pixelWidth) ||
      !Number.isFinite(args.pixelHeight) ||
      args.pixelWidth <= 0 ||
      args.pixelHeight <= 0
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
      pixelWidth: Math.round(args.pixelWidth),
      pixelHeight: Math.round(args.pixelHeight),
      uploadedByUserId: user._id,
      createdAt: now,
    });

    return {
      _id: assetId,
      storageId: args.storageId,
      fileName,
      mimeType: metadata.mimeType,
      byteSize: metadata.byteSize,
      pixelWidth: Math.round(args.pixelWidth),
      pixelHeight: Math.round(args.pixelHeight),
      createdAt: now,
      url: await ctx.storage.getUrl(args.storageId),
    };
  },
});

export const deleteTemplateAsset = mutation({
  args: {
    assetId: v.id("templateAssets"),
  },
  returns: v.null(),
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
      throw new ConvexError("This image is still used by a template");
    }

    await ctx.storage.delete(asset.storageId);
    await ctx.db.delete(asset._id);
    return null;
  },
});


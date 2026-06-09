import { v } from "convex/values";

export const templateAssetValidator = v.object({
  _id: v.id("templateAssets"),
  storageId: v.id("_storage"),
  fileName: v.string(),
  mimeType: v.string(),
  byteSize: v.number(),
  pixelWidth: v.union(v.number(), v.null()),
  pixelHeight: v.union(v.number(), v.null()),
  createdAt: v.number(),
  url: v.union(v.string(), v.null()),
});


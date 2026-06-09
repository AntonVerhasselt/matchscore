export const ALLOWED_TEMPLATE_ASSET_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type TemplateAssetMimeType =
  (typeof ALLOWED_TEMPLATE_ASSET_MIME_TYPES)[number];

export const MAX_TEMPLATE_ASSET_BYTE_SIZE = 8 * 1024 * 1024;


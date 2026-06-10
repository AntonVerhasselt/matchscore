"use node";

import { Canvas, loadImage, type Image as SkiaImage } from "skia-canvas";

import type { ImageBindingKey } from "../../../lib/template-scene";
import { createPlaceholderCrestSvg } from "../../../lib/template-scene/placeholder-crest";

const PLACEHOLDER_CREST_SIZE = 240;

const crestImageCache = new Map<ImageBindingKey, Promise<SkiaImage>>();

async function rasterizePlaceholderCrest(
  bindingKey: ImageBindingKey,
): Promise<SkiaImage> {
  const svgImage = await loadImage(
    Buffer.from(createPlaceholderCrestSvg(bindingKey, "preview"), "utf8"),
  );
  const canvas = new Canvas(PLACEHOLDER_CREST_SIZE, PLACEHOLDER_CREST_SIZE);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(svgImage, 0, 0, PLACEHOLDER_CREST_SIZE, PLACEHOLDER_CREST_SIZE);
  return loadImage(await canvas.toBuffer("png"));
}

export function loadPlaceholderCrestImage(
  bindingKey: ImageBindingKey,
): Promise<SkiaImage> {
  const cached = crestImageCache.get(bindingKey);
  if (cached) {
    return cached;
  }

  const pending = rasterizePlaceholderCrest(bindingKey);
  crestImageCache.set(bindingKey, pending);
  return pending;
}

export function resetPlaceholderCrestImageCacheForTests(): void {
  crestImageCache.clear();
}

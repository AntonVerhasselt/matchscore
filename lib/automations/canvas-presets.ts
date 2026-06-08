import type { CanvasPreset } from "@/lib/automations/types";

export const CANVAS_PRESET_LABELS: Record<CanvasPreset, string> = {
  instagram_square: "1080×1080",
  instagram_portrait: "1080×1350",
  facebook_landscape: "1200×630",
};

export const CANVAS_PRESET_DIMENSIONS: Record<
  CanvasPreset,
  { width: number; height: number }
> = {
  instagram_square: { width: 1080, height: 1080 },
  instagram_portrait: { width: 1080, height: 1350 },
  facebook_landscape: { width: 1200, height: 630 },
};

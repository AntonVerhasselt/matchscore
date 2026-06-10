import type { SceneNode } from "./index";

/** Used when the canvas background is a photo; favors light text on typical imagery. */
const IMAGE_BACKGROUND_ASSUMPTION = "#374151";

const TEXT_ON_LIGHT_BACKGROUND = "#000000";
const TEXT_ON_DARK_BACKGROUND = "#ffffff";

const LUMINANCE_LIGHT_THRESHOLD = 0.55;

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) {
    return null;
  }

  let hex = match[1]!.toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((channel) => channel + channel)
      .join("");
  }

  return `#${hex}`;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex) ?? "#000000";
  const channels = normalized.slice(1);
  return {
    r: Number.parseInt(channels.slice(0, 2), 16),
    g: Number.parseInt(channels.slice(2, 4), 16),
    b: Number.parseInt(channels.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function resolveSceneBackgroundFill(
  backgroundNode: SceneNode | null,
  defaultFill = "#ffffff",
): string {
  if (!backgroundNode) {
    return defaultFill;
  }

  if (backgroundNode.className === "Rect") {
    const fill = backgroundNode.attrs.fill;
    return typeof fill === "string" && fill.trim().length > 0
      ? fill
      : defaultFill;
  }

  if (backgroundNode.className === "Image") {
    return IMAGE_BACKGROUND_ASSUMPTION;
  }

  return defaultFill;
}

export function pickContrastingTextColor(backgroundFill: string): string {
  const normalized = normalizeHexColor(backgroundFill) ?? "#ffffff";
  return relativeLuminance(normalized) > LUMINANCE_LIGHT_THRESHOLD
    ? TEXT_ON_LIGHT_BACKGROUND
    : TEXT_ON_DARK_BACKGROUND;
}

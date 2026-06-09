const KONVA_FONT_STYLES = new Set([
  "normal",
  "italic",
  "bold",
  "bold italic",
  "italic bold",
]);

export type KonvaFontStyle = "normal" | "italic" | "bold" | "bold italic";

export function parseKonvaFontStyle(
  fontStyle: string | undefined,
): { bold: boolean; italic: boolean } {
  const normalized = (fontStyle ?? "normal").toLowerCase();
  return {
    bold: normalized.includes("bold"),
    italic: normalized.includes("italic"),
  };
}

export function buildKonvaFontStyle(bold: boolean, italic: boolean): KonvaFontStyle {
  if (bold && italic) {
    return "bold italic";
  }
  if (bold) {
    return "bold";
  }
  if (italic) {
    return "italic";
  }
  return "normal";
}

export function isUnderline(textDecoration: string | undefined): boolean {
  return textDecoration === "underline";
}

export function toggleUnderline(textDecoration: string | undefined): string {
  return isUnderline(textDecoration) ? "" : "underline";
}

export function getKonvaFontStyle(
  fontStyle: string | undefined,
): KonvaFontStyle {
  const { bold, italic } = parseKonvaFontStyle(fontStyle);
  return buildKonvaFontStyle(bold, italic);
}

export function getTextDecoration(
  textDecoration: string | undefined,
): "" | "underline" {
  return isUnderline(textDecoration) ? "underline" : "";
}

export function isValidKonvaFontStyle(value: unknown): value is KonvaFontStyle {
  return typeof value === "string" && KONVA_FONT_STYLES.has(value);
}

export function isValidTextDecoration(
  value: unknown,
): value is "" | "underline" {
  return value === "" || value === "underline" || value === undefined;
}

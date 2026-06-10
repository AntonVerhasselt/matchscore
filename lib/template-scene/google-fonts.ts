export type FontSource = "system" | "google";

export type TemplateFontOption = {
  family: string;
  source: FontSource;
  category: string;
};

const SYSTEM_FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Verdana",
] as const;

export const GOOGLE_FONT_CATALOG: Array<{ family: string; category: string }> = [
  { family: "Inter", category: "Sans Serif" },
  { family: "Roboto", category: "Sans Serif" },
  { family: "Open Sans", category: "Sans Serif" },
  { family: "Lato", category: "Sans Serif" },
  { family: "Montserrat", category: "Sans Serif" },
  { family: "Oswald", category: "Sans Serif" },
  { family: "Raleway", category: "Sans Serif" },
  { family: "Poppins", category: "Sans Serif" },
  { family: "Nunito", category: "Sans Serif" },
  { family: "Ubuntu", category: "Sans Serif" },
  { family: "Rubik", category: "Sans Serif" },
  { family: "Work Sans", category: "Sans Serif" },
  { family: "Barlow", category: "Sans Serif" },
  { family: "DM Sans", category: "Sans Serif" },
  { family: "Manrope", category: "Sans Serif" },
  { family: "Source Sans 3", category: "Sans Serif" },
  { family: "PT Sans", category: "Sans Serif" },
  { family: "Mulish", category: "Sans Serif" },
  { family: "Karla", category: "Sans Serif" },
  { family: "Archivo", category: "Sans Serif" },
  { family: "Figtree", category: "Sans Serif" },
  { family: "Outfit", category: "Sans Serif" },
  { family: "Lexend", category: "Sans Serif" },
  { family: "Sora", category: "Sans Serif" },
  { family: "Bebas Neue", category: "Display" },
  { family: "Anton", category: "Display" },
  { family: "Teko", category: "Display" },
  { family: "Russo One", category: "Display" },
  { family: "Bangers", category: "Display" },
  { family: "Abril Fatface", category: "Display" },
  { family: "Alfa Slab One", category: "Display" },
  { family: "Black Ops One", category: "Display" },
  { family: "Passion One", category: "Display" },
  { family: "Staatliches", category: "Display" },
  { family: "Playfair Display", category: "Serif" },
  { family: "Merriweather", category: "Serif" },
  { family: "Lora", category: "Serif" },
  { family: "Roboto Slab", category: "Serif" },
  { family: "Bitter", category: "Serif" },
  { family: "Libre Baskerville", category: "Serif" },
  { family: "Cormorant Garamond", category: "Serif" },
  { family: "Roboto Mono", category: "Monospace" },
  { family: "Fira Code", category: "Monospace" },
  { family: "JetBrains Mono", category: "Monospace" },
  { family: "Dancing Script", category: "Handwriting" },
  { family: "Pacifico", category: "Handwriting" },
  { family: "Caveat", category: "Handwriting" },
];

export const TEMPLATE_FONT_OPTIONS: TemplateFontOption[] = [
  ...SYSTEM_FONT_FAMILIES.map((family) => ({
    family,
    source: "system" as const,
    category: "System",
  })),
  ...GOOGLE_FONT_CATALOG.map(({ family, category }) => ({
    family,
    source: "google" as const,
    category,
  })),
];

const GOOGLE_FONT_FAMILIES = new Set(
  GOOGLE_FONT_CATALOG.map((font) => font.family),
);

/** Google Fonts used as server-side stand-ins for system fonts on Linux. */
export const SYSTEM_FONT_SERVER_SOURCES: Readonly<Record<string, string>> = {
  Arial: "Arimo",
  Helvetica: "Arimo",
  Georgia: "Tinos",
  "Times New Roman": "Tinos",
  Verdana: "Open Sans",
};

/** Downloaded for server render only; not shown in the editor font picker. */
export const SERVER_ONLY_FONT_FAMILIES = ["Arimo", "Tinos"] as const;

export function isSystemFontFamily(family: string): boolean {
  return (SYSTEM_FONT_FAMILIES as readonly string[]).includes(family);
}

export function isGoogleFontFamily(family: string): boolean {
  return GOOGLE_FONT_FAMILIES.has(family);
}

export function shouldLoadGoogleFont(family: string): boolean {
  return !isSystemFontFamily(family) && isGoogleFontFamily(family);
}

export function encodeGoogleFontFamily(family: string): string {
  return encodeURIComponent(family).replace(/%20/g, "+");
}

export function buildGoogleFontsStylesheetUrl(families: string[]): string {
  const uniqueFamilies = [...new Set(families.filter(shouldLoadGoogleFont))];
  if (uniqueFamilies.length === 0) {
    return "";
  }

  return buildGoogleFontsStylesheetUrlForFamilies(uniqueFamilies);
}

/**
 * Builds a Google Fonts CSS2 URL for pre-validated family names.
 * Callers (e.g. buildGoogleFontsStylesheetUrl, sync-template-fonts) must pass
 * trusted catalog or server-only names; this only trims, deduplicates, and
 * URL-encodes via encodeGoogleFontFamily.
 */
export function buildGoogleFontsStylesheetUrlForFamilies(
  families: string[],
): string {
  const uniqueFamilies = [...new Set(families.filter((family) => family.trim().length > 0))];
  if (uniqueFamilies.length === 0) {
    return "";
  }

  const familyParams = uniqueFamilies
    .map(
      (family) =>
        `family=${encodeGoogleFontFamily(family)}:ital,wght@0,400;0,700;1,400;1,700`,
    )
    .join("&");

  return `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
}

const loadedFontFamilies = new Set<string>();

export function loadGoogleFonts(families: string[]): void {
  if (typeof document === "undefined") {
    return;
  }

  const toLoad = families.filter(
    (family) => shouldLoadGoogleFont(family) && !loadedFontFamilies.has(family),
  );
  if (toLoad.length === 0) {
    return;
  }

  for (const family of toLoad) {
    loadedFontFamilies.add(family);
  }

  const href = buildGoogleFontsStylesheetUrl(toLoad);
  if (!href) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

type FontWalkNode = {
  className: string;
  attrs: Record<string, unknown>;
  children?: FontWalkNode[];
};

export function collectSceneFontFamilies(stage: FontWalkNode): string[] {
  const families = new Set<string>();

  const walk = (node: FontWalkNode) => {
    if (node.className === "Text") {
      const family = node.attrs.fontFamily;
      if (typeof family === "string") {
        const trimmedFamily = family.trim();
        if (trimmedFamily.length > 0) {
          families.add(trimmedFamily);
        }
      }
    }

    node.children?.forEach(walk);
  };

  walk(stage);
  return [...families];
}

export function searchTemplateFonts(query: string): TemplateFontOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return TEMPLATE_FONT_OPTIONS;
  }

  return TEMPLATE_FONT_OPTIONS.filter(
    (font) =>
      font.family.toLowerCase().includes(normalizedQuery) ||
      font.category.toLowerCase().includes(normalizedQuery),
  );
}

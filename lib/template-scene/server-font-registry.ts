import {
  GOOGLE_FONT_CATALOG,
  isSystemFontFamily,
  SYSTEM_FONT_SERVER_SOURCES,
} from "./google-fonts";
import { TEMPLATE_FONT_MANIFEST } from "./server-font-manifest.generated";

export type FontRegistrationEntry = {
  family: string;
  urls: string[];
};

export function getGoogleCatalogFamilies(): string[] {
  return GOOGLE_FONT_CATALOG.map((font) => font.family);
}

function getManifestUrlsForFamily(family: string): string[] | undefined {
  const manifestEntry = TEMPLATE_FONT_MANIFEST[family];
  if (!manifestEntry || manifestEntry.length === 0) {
    return undefined;
  }
  return [...manifestEntry];
}

export function getFontUrlsForFamilies(families: string[]): FontRegistrationEntry[] {
  const entries: FontRegistrationEntry[] = [];
  const seen = new Set<string>();

  for (const family of families) {
    if (seen.has(family)) {
      continue;
    }

    if (isSystemFontFamily(family)) {
      const sourceFamily = SYSTEM_FONT_SERVER_SOURCES[family];
      const urls = sourceFamily ? getManifestUrlsForFamily(sourceFamily) : undefined;
      if (urls) {
        entries.push({ family, urls });
        seen.add(family);
      }
      continue;
    }

    const urls = getManifestUrlsForFamily(family);
    if (urls) {
      entries.push({ family, urls });
      seen.add(family);
    }
  }

  return entries;
}

/** @deprecated Use getFontUrlsForFamilies */
export function getFontFilesForFamilies(families: string[]): FontRegistrationEntry[] {
  return getFontUrlsForFamilies(families);
}

export function assertTemplateFontManifestUsesRemoteUrls(): void {
  for (const [family, urls] of Object.entries(TEMPLATE_FONT_MANIFEST)) {
    if (urls.length === 0) {
      throw new Error(`Font manifest entry for ${family} is empty`);
    }

    for (const url of urls) {
      if (!url.startsWith("https://")) {
        throw new Error(
          `Font manifest entry for ${family} must use https URLs, got: ${url}`,
        );
      }
    }
  }

  for (const [systemFamily, sourceFamily] of Object.entries(
    SYSTEM_FONT_SERVER_SOURCES,
  )) {
    const urls = TEMPLATE_FONT_MANIFEST[sourceFamily];
    if (!urls || urls.length === 0) {
      throw new Error(
        `System font ${systemFamily} requires manifest entry for ${sourceFamily}`,
      );
    }
  }
}

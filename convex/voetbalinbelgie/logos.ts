/**
 * Import-only logo URL helpers and action-side download helper.
 */

const DEFAULT_PUBLIC_BASE = "https://www.voetbalinbelgie.be";

export function normalizeLogoSourceUrl(
  sourceUrl: string,
  publicBase = DEFAULT_PUBLIC_BASE,
): string {
  if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
    return sourceUrl;
  }

  const base = publicBase.endsWith("/") ? publicBase.slice(0, -1) : publicBase;
  const path = sourceUrl.startsWith("/") ? sourceUrl : `/${sourceUrl}`;
  return `${base}${path}`;
}

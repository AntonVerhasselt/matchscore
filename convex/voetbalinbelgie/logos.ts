/**
 * Import-only logo helpers. Full Convex storage download is implemented in Phase 4.
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

/**
 * Import-only logo URL helpers and action-side download helper.
 */

const DEFAULT_PUBLIC_BASE = "https://www.voetbalinbelgie.be";

const TRUSTED_LOGO_HOSTS = new Set([
  "www.voetbalinbelgie.be",
  "voetbalinbelgie.be",
  "api.voetbalinbelgie.be",
]);

function assertTrustedAbsoluteLogoUrl(sourceUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error(`Invalid logo URL: ${sourceUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported logo URL protocol: ${parsed.protocol}`);
  }

  if (!TRUSTED_LOGO_HOSTS.has(parsed.hostname)) {
    throw new Error(`Untrusted logo URL host: ${parsed.hostname}`);
  }

  return parsed.toString();
}

export function normalizeLogoSourceUrl(
  sourceUrl: string,
  publicBase = DEFAULT_PUBLIC_BASE,
): string {
  if (sourceUrl.includes("://")) {
    return assertTrustedAbsoluteLogoUrl(sourceUrl);
  }

  const base = publicBase.endsWith("/") ? publicBase.slice(0, -1) : publicBase;
  const path = sourceUrl.startsWith("/") ? sourceUrl : `/${sourceUrl}`;
  return `${base}${path}`;
}

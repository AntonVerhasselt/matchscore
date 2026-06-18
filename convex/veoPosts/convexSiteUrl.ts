/** Resolve the Convex `.convex.site` base URL for HTTP webhooks. */
export function getConvexSiteUrl(): string {
  const explicit =
    process.env.CONVEX_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const cloudUrl = process.env.CONVEX_CLOUD_URL?.trim();
  if (cloudUrl) {
    return cloudUrl.replace(".convex.cloud", ".convex.site").replace(/\/$/, "");
  }

  throw new Error(
    "Convex site URL is not configured. Set CONVEX_CLOUD_URL or CONVEX_SITE_URL.",
  );
}

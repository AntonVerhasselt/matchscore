import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normalizeLogoSourceUrl } from "../voetbalinbelgie/logos";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export async function downloadLogoToStorage(
  ctx: ActionCtx,
  sourceUrl: string,
): Promise<Id<"_storage">> {
  const logoSourceUrl = normalizeLogoSourceUrl(sourceUrl);

  const existing: Id<"_storage"> | null = await ctx.runQuery(
    internal.football.internalQueries.getLogoStorageIdBySourceUrl,
    { logoSourceUrl },
  );
  if (existing) {
    return existing;
  }

  const response = await fetch(logoSourceUrl, {
    signal: AbortSignal.timeout(10_000),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Logo fetch timed out for ${logoSourceUrl}`);
    }
    throw error;
  });
  if (!response.ok) {
    throw new Error(
      `Logo fetch failed (${response.status}) for ${logoSourceUrl}`,
    );
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_LOGO_BYTES) {
    throw new Error(
      `Logo exceeds max size (${contentLength} bytes) for ${logoSourceUrl}`,
    );
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.startsWith("image/")) {
    throw new Error(
      `Unexpected logo content-type (${contentType ?? "missing"}) for ${logoSourceUrl}`,
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_LOGO_BYTES) {
    throw new Error(
      `Logo exceeds max size (${buffer.byteLength} bytes) for ${logoSourceUrl}`,
    );
  }

  return await ctx.storage.store(
    new Blob([buffer], { type: contentType }),
  );
}

export function slugFromPath(slugPath: string): string {
  const segments = slugPath.split("/").filter(Boolean);
  return segments.at(-1) ?? "";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normalizeLogoSourceUrl } from "../voetbalinbelgie/logos";

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

  const response = await fetch(logoSourceUrl);
  if (!response.ok) {
    throw new Error(
      `Logo fetch failed (${response.status}) for ${logoSourceUrl}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const buffer = await response.arrayBuffer();
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

"use node";

import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Matches plan cap: ~200 MB compiled output for up to 15 goals. */
export const MAX_VGF_OUTPUT_BYTES = 200 * 1024 * 1024;

const DOWNLOAD_TIMEOUT_MS = 120_000;
const UPLOAD_TIMEOUT_MS = 180_000;

type DownloadVgfOutputResult = {
  storageId: Id<"_storage">;
  byteSize: number;
};

function parseContentLength(response: Response): number | null {
  const header = response.headers.get("content-length");
  if (!header) {
    return null;
  }

  const byteSize = Number(header);
  if (!Number.isFinite(byteSize) || byteSize < 0) {
    return null;
  }

  return byteSize;
}

function assertOutputSizeWithinLimit(byteSize: number | null): void {
  if (byteSize !== null && byteSize > MAX_VGF_OUTPUT_BYTES) {
    throw new Error("Compiled video exceeds the maximum allowed size");
  }
}

function parseUploadStorageId(payload: unknown): Id<"_storage"> {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("storageId" in payload) ||
    typeof (payload as { storageId: unknown }).storageId !== "string"
  ) {
    throw new Error("Convex storage upload returned an invalid response");
  }

  return (payload as { storageId: Id<"_storage"> }).storageId;
}

/**
 * Streams a remote MP4 into Convex file storage via a generated upload URL.
 * Avoids buffering the full file in action memory (required for ~45 MB+ outputs).
 *
 * @see https://docs.convex.dev/file-storage/upload-files
 * @see https://docs.convex.dev/functions/actions (Node.js actions: 512 MB memory)
 */
async function streamRemoteFileToStorage(
  ctx: ActionCtx,
  sourceResponse: Response,
  byteSizeHint: number | null,
): Promise<DownloadVgfOutputResult> {
  if (!sourceResponse.body) {
    throw new Error("Compiled video download returned an empty body");
  }

  const uploadUrl = await ctx.storage.generateUploadUrl();
  const contentType =
    sourceResponse.headers.get("content-type")?.trim() || "video/mp4";

  const uploadHeaders: Record<string, string> = {
    "Content-Type": contentType,
  };
  if (byteSizeHint !== null) {
    uploadHeaders["Content-Length"] = String(byteSizeHint);
  }

  const uploadInit: RequestInit & { duplex?: "half" } = {
    method: "POST",
    headers: uploadHeaders,
    body: sourceResponse.body,
    duplex: "half",
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  };

  const uploadResponse = await fetch(uploadUrl, uploadInit).catch(
    (error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Timed out while uploading the compiled video");
      }
      throw error;
    },
  );

  if (!uploadResponse.ok) {
    throw new Error(`Convex storage upload failed (${uploadResponse.status})`);
  }

  const storageId = parseUploadStorageId(await uploadResponse.json());
  return {
    storageId,
    byteSize: byteSizeHint ?? 0,
  };
}

/** Fallback when streaming upload is unavailable: store via blob in Node (512 MB limit). */
async function storeRemoteFileViaBlob(
  ctx: ActionCtx,
  sourceResponse: Response,
  byteSizeHint: number | null,
): Promise<DownloadVgfOutputResult> {
  const blob = await sourceResponse.blob();
  if (blob.size > MAX_VGF_OUTPUT_BYTES) {
    throw new Error("Compiled video exceeds the maximum allowed size");
  }

  const storageId = await ctx.storage.store(blob);
  return {
    storageId,
    byteSize: byteSizeHint ?? blob.size,
  };
}

export async function downloadVgfOutputToStorage(
  ctx: ActionCtx,
  outputUrl: string,
  byteSizeHint: number | null = null,
): Promise<DownloadVgfOutputResult> {
  const sourceResponse = await fetch(outputUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timed out while downloading the compiled video");
    }
    throw error;
  });

  if (!sourceResponse.ok) {
    throw new Error(`Compiled video download failed (${sourceResponse.status})`);
  }

  const contentLength = parseContentLength(sourceResponse);
  assertOutputSizeWithinLimit(contentLength);
  assertOutputSizeWithinLimit(byteSizeHint);

  const resolvedByteSize = byteSizeHint ?? contentLength;

  try {
    return await streamRemoteFileToStorage(
      ctx,
      sourceResponse,
      resolvedByteSize,
    );
  } catch (streamError) {
    const retryResponse = await fetch(outputUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Timed out while downloading the compiled video");
      }
      throw error;
    });

    if (!retryResponse.ok) {
      throw streamError;
    }

    const retryByteSize =
      resolvedByteSize ?? parseContentLength(retryResponse);
    assertOutputSizeWithinLimit(retryByteSize);

    try {
      return await storeRemoteFileViaBlob(ctx, retryResponse, retryByteSize);
    } catch {
      throw streamError;
    }
  }
}

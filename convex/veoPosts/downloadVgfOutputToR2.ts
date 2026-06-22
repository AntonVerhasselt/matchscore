"use node";

import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  goalHighlightObjectKey,
  goalHighlightsR2,
} from "./r2Client";

/** Matches plan cap: ~200 MB compiled output for up to 15 goals. */
export const MAX_VGF_OUTPUT_BYTES = 200 * 1024 * 1024;

const DOWNLOAD_TIMEOUT_MS = 120_000;
const UPLOAD_TIMEOUT_MS = 180_000;

export type DownloadVgfOutputToR2Result = {
  r2Key: string;
  byteSize: number;
};

export function parseContentLength(response: Response): number | null {
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

export function assertOutputSizeWithinLimit(byteSize: number | null): void {
  if (byteSize !== null && byteSize > MAX_VGF_OUTPUT_BYTES) {
    throw new Error("Compiled video exceeds the maximum allowed size");
  }
}

/**
 * Streams a remote MP4 into R2 via a signed PUT URL.
 * Avoids buffering the full file in action memory when streaming works.
 */
async function streamRemoteFileToR2(
  ctx: ActionCtx,
  jobId: Id<"veoPostJobs">,
  sourceResponse: Response,
  byteSizeHint: number | null,
): Promise<DownloadVgfOutputToR2Result> {
  if (!sourceResponse.body) {
    throw new Error("Compiled video download returned an empty body");
  }

  const r2Key = goalHighlightObjectKey(jobId);
  const { url: uploadUrl } = await goalHighlightsR2.generateUploadUrl(r2Key);
  const contentType =
    sourceResponse.headers.get("content-type")?.trim() || "video/mp4";

  const uploadHeaders: Record<string, string> = {
    "Content-Type": contentType,
  };
  if (byteSizeHint !== null) {
    uploadHeaders["Content-Length"] = String(byteSizeHint);
  }

  const uploadInit: RequestInit & { duplex?: "half" } = {
    method: "PUT",
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
    throw new Error(`R2 upload failed (${uploadResponse.status})`);
  }

  await goalHighlightsR2.syncMetadata(ctx, r2Key);

  return {
    r2Key,
    byteSize: byteSizeHint ?? 0,
  };
}

/** Fallback when streaming upload is unavailable: store via blob in Node (512 MB limit). */
async function storeRemoteFileViaBlob(
  ctx: ActionCtx,
  jobId: Id<"veoPostJobs">,
  sourceResponse: Response,
  byteSizeHint: number | null,
): Promise<DownloadVgfOutputToR2Result> {
  const blob = await sourceResponse.blob();
  if (blob.size > MAX_VGF_OUTPUT_BYTES) {
    throw new Error("Compiled video exceeds the maximum allowed size");
  }

  const r2Key = await goalHighlightsR2.store(ctx, blob, {
    key: goalHighlightObjectKey(jobId),
    type: "video/mp4",
    cacheControl: "private, max-age=31536000",
  });

  return {
    r2Key,
    byteSize: byteSizeHint ?? blob.size,
  };
}

export async function downloadVgfOutputToR2(
  ctx: ActionCtx,
  jobId: Id<"veoPostJobs">,
  outputUrl: string,
  byteSizeHint: number | null = null,
): Promise<DownloadVgfOutputToR2Result> {
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
    return await streamRemoteFileToR2(
      ctx,
      jobId,
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
      return await storeRemoteFileViaBlob(
        ctx,
        jobId,
        retryResponse,
        retryByteSize,
      );
    } catch {
      throw streamError;
    }
  }
}

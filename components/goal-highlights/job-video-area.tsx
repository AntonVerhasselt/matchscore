"use client";

import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Doc } from "@/convex/_generated/dataModel";

type JobStatus = Doc<"veoPostJobs">["status"];

function sanitizeDownloadFilename(title: string): string {
  const sanitized = title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  return sanitized ? `${sanitized}.mp4` : "goal-highlights.mp4";
}

async function downloadVideoFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type JobVideoAreaProps = {
  status: JobStatus;
  processingLabel: string;
  fetchingLabel: string;
  pendingLabel: string;
  failedLabel: string;
  expiredLabel: string;
  expiredDescription: string;
  regenerateLabel: string;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
  errorMessage: string | null;
  outputVideoUrl: string | null;
  hasVideo: boolean;
  videoExpired: boolean;
  downloadLabel: string;
  downloadingLabel: string;
  downloadFailedLabel: string;
  videoTitle: string;
};

export function JobVideoArea({
  status,
  processingLabel,
  fetchingLabel,
  pendingLabel,
  failedLabel,
  expiredLabel,
  expiredDescription,
  regenerateLabel,
  isRegenerating = false,
  onRegenerate,
  errorMessage,
  outputVideoUrl,
  hasVideo,
  videoExpired,
  downloadLabel,
  downloadingLabel,
  downloadFailedLabel,
  videoTitle,
}: JobVideoAreaProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!outputVideoUrl || isDownloading) {
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      await downloadVideoFile(
        outputVideoUrl,
        sanitizeDownloadFilename(videoTitle),
      );
    } catch {
      setDownloadError(downloadFailedLabel);
    } finally {
      setIsDownloading(false);
    }
  };

  if (status === "failed") {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertDescription>{errorMessage ?? failedLabel}</AlertDescription>
        </Alert>
        {onRegenerate ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {regenerateLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "ready" && hasVideo && outputVideoUrl) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border bg-black">
          <video
            className="aspect-video w-full"
            controls
            preload="metadata"
            src={outputVideoUrl}
            title={videoTitle}
          />
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={isDownloading}
            onClick={() => void handleDownload()}
          >
            {isDownloading ? downloadingLabel : downloadLabel}
          </Button>
          {downloadError ? (
            <p className="text-sm text-destructive">{downloadError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (status === "ready" && videoExpired) {
    return (
      <div className="space-y-3">
        <Alert>
          <AlertDescription>
            <span className="font-medium">{expiredLabel}</span>
            <span className="mt-1 block text-sm">{expiredDescription}</span>
          </AlertDescription>
        </Alert>
        {onRegenerate ? (
          <Button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            {regenerateLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "ready") {
    return (
      <Alert>
        <AlertDescription>{failedLabel}</AlertDescription>
      </Alert>
    );
  }

  const message =
    status === "fetching"
      ? fetchingLabel
      : status === "processing"
        ? processingLabel
        : pendingLabel;

  return (
    <div
      className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 px-6 text-center"
      aria-live="polite"
    >
      <Skeleton className="h-12 w-12 rounded-full" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

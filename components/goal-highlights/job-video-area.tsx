import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Doc } from "@/convex/_generated/dataModel";

type JobStatus = Doc<"veoPostJobs">["status"];

type JobVideoAreaProps = {
  status: JobStatus;
  processingLabel: string;
  fetchingLabel: string;
  pendingLabel: string;
  failedLabel: string;
  errorMessage: string | null;
  outputVideoUrl: string | null;
  downloadLabel: string;
  videoTitle: string;
};

export function JobVideoArea({
  status,
  processingLabel,
  fetchingLabel,
  pendingLabel,
  failedLabel,
  errorMessage,
  outputVideoUrl,
  downloadLabel,
  videoTitle,
}: JobVideoAreaProps) {
  if (status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage ?? failedLabel}</AlertDescription>
      </Alert>
    );
  }

  if (status === "ready" && outputVideoUrl) {
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
        <div>
          <Button asChild variant="outline">
            <a href={outputVideoUrl} download={`${videoTitle}.mp4`}>
              {downloadLabel}
            </a>
          </Button>
        </div>
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

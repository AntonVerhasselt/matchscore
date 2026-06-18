import { Alert, AlertDescription } from "@/components/ui/alert";
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
};

export function JobVideoArea({
  status,
  processingLabel,
  fetchingLabel,
  pendingLabel,
  failedLabel,
  errorMessage,
}: JobVideoAreaProps) {
  if (status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage ?? failedLabel}</AlertDescription>
      </Alert>
    );
  }

  if (status === "ready") {
    return null;
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

"use client";

import { useParams, useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { AppPageBackLink } from "@/components/app-page";
import { DeleteJobDialog } from "@/components/goal-highlights/delete-job-dialog";
import { JobComposeSection } from "@/components/goal-highlights/job-compose-section";
import { JobStatusBadge } from "@/components/goal-highlights/job-status-badge";
import { JobVideoArea } from "@/components/goal-highlights/job-video-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getGoalHighlightsErrorMessage } from "@/lib/goal-highlights/get-error-message";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";

export default function GoalHighlightJobPage() {
  const t = useTranslations("app.goalHighlights");
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId as Id<"veoPostJobs">;
  const job = useQuery(api.veoPosts.queries.getJob, { jobId });
  const deleteJob = useMutation(api.veoPosts.mutations.deleteJob);
  const regenerateJob = useAction(api.veoPosts.actions.regenerateJob);
  const shownFailureRef = useRef<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    if (job === null) {
      router.replace("/app/goal-highlights");
    }
  }, [job, router]);

  useEffect(() => {
    if (!job || job.status !== "failed" || !job.errorMessage) {
      return;
    }

    const failureKey = `${job._id}:${job.failedAt ?? job.errorMessage}`;
    if (shownFailureRef.current === failureKey) {
      return;
    }

    shownFailureRef.current = failureKey;
    showErrorToast(job.errorMessage);
  }, [job]);

  if (job === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (job === null) {
    return null;
  }

  const title = job.veoMatchTitle ?? job.veoMatchSlug;
  const scoreLine =
    job.veoScoreOwn !== null && job.veoScoreOpponent !== null
      ? t("scoreLine", {
          own: job.veoScoreOwn,
          opponent: job.veoScoreOpponent,
        })
      : null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteJob({ jobId });
      showSuccessToast(t("deleteSuccess"));
      router.replace("/app/goal-highlights");
    } catch {
      showErrorToast(t("deleteFailed"));
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await regenerateJob({ jobId });
      showSuccessToast(t("regenerateStarted"));
    } catch (error) {
      showErrorToast(getGoalHighlightsErrorMessage(error, (key, values) => t(key, values)));
    } finally {
      setIsRegenerating(false);
    }
  };

  const showRegenerate =
    job.status === "failed" ||
    (job.status === "ready" && job.videoExpired);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <AppPageBackLink href="/app/goal-highlights">
            {t("backToList")}
          </AppPageBackLink>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <JobStatusBadge
              status={job.status}
              label={t(`status.${job.status}`)}
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("delete")}
        </Button>
      </div>

      <JobVideoArea
        status={job.status}
        pendingLabel={t("videoArea.pending")}
        fetchingLabel={t("videoArea.fetching")}
        processingLabel={t("videoArea.processing")}
        failedLabel={t("videoArea.failed")}
        expiredLabel={t("videoArea.expired")}
        expiredDescription={t("videoArea.expiredDescription")}
        regenerateLabel={
          isRegenerating ? t("regenerating") : t("regenerateVideo")
        }
        isRegenerating={isRegenerating}
        onRegenerate={showRegenerate ? () => void handleRegenerate() : undefined}
        errorMessage={job.errorMessage}
        outputVideoUrl={job.outputVideoUrl}
        hasVideo={job.hasVideo}
        videoExpired={job.videoExpired}
        downloadLabel={t("videoArea.download")}
        downloadingLabel={t("videoArea.downloading")}
        downloadFailedLabel={t("videoArea.downloadFailed")}
        videoTitle={title}
      />

      {(scoreLine || job.goalCount !== null || job.expiresAt !== null) && (
        <div className="text-sm text-muted-foreground">
          {scoreLine ? <span>{scoreLine}</span> : null}
          {scoreLine && job.goalCount !== null ? <span> · </span> : null}
          {job.goalCount !== null ? (
            <span>{t("goalCount", { count: job.goalCount })}</span>
          ) : null}
          {job.hasVideo && job.expiresAt !== null ? (
            <>
              {(scoreLine || job.goalCount !== null) ? <span> · </span> : null}
              <span>
                {t("expiresOn", {
                  date: new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                  }).format(new Date(job.expiresAt)),
                })}
              </span>
            </>
          ) : null}
          {job.videoExpired ? (
            <>
              {(scoreLine || job.goalCount !== null) ? <span> · </span> : null}
              <span>{t("videoExpired")}</span>
            </>
          ) : null}
        </div>
      )}

      {job.warningMessage ? (
        <Alert>
          <AlertTitle>{t("warningTitle")}</AlertTitle>
          <AlertDescription>{job.warningMessage}</AlertDescription>
        </Alert>
      ) : null}

      <JobComposeSection
        key={job._id}
        jobId={job._id}
        draftCaption={job.draftCaption}
        postingChannels={job.postingChannels}
        hasVideo={job.hasVideo}
        status={job.status}
      />

      <DeleteJobDialog
        jobTitle={title}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => void handleDelete()}
        isDeleting={isDeleting}
      />
    </div>
  );
}

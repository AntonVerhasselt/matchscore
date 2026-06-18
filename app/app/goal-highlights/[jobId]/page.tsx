"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { AppPageBackLink } from "@/components/app-page";
import { JobStatusBadge } from "@/components/goal-highlights/job-status-badge";
import { JobVideoArea } from "@/components/goal-highlights/job-video-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { showErrorToast } from "@/lib/user-feedback";

export default function GoalHighlightJobPage() {
  const t = useTranslations("app.goalHighlights");
  const router = useRouter();
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId as Id<"veoPostJobs">;
  const job = useQuery(api.veoPosts.queries.getJob, { jobId });
  const shownFailureRef = useRef<string | null>(null);

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
      </div>

      <JobVideoArea
        status={job.status}
        pendingLabel={t("videoArea.pending")}
        fetchingLabel={t("videoArea.fetching")}
        processingLabel={t("videoArea.processing")}
        failedLabel={t("videoArea.failed")}
        errorMessage={job.errorMessage}
      />

      {(scoreLine || job.goalCount !== null) && (
        <div className="text-sm text-muted-foreground">
          {scoreLine ? <span>{scoreLine}</span> : null}
          {scoreLine && job.goalCount !== null ? <span> · </span> : null}
          {job.goalCount !== null ? (
            <span>{t("goalCount", { count: job.goalCount })}</span>
          ) : null}
        </div>
      )}

      {job.warningMessage ? (
        <Alert>
          <AlertTitle>{t("warningTitle")}</AlertTitle>
          <AlertDescription>{job.warningMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

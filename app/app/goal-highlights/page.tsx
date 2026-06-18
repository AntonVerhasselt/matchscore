"use client";

import { useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AppPageHeader } from "@/components/app-page";
import { JobHistoryList } from "@/components/goal-highlights/job-history-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { getGoalHighlightsErrorMessage } from "@/lib/goal-highlights/get-error-message";
import { showErrorToast, showSuccessToast } from "@/lib/user-feedback";

export default function GoalHighlightsPage() {
  const t = useTranslations("app.goalHighlights");
  const router = useRouter();
  const jobs = useQuery(api.veoPosts.queries.listJobs);
  const createOrOpenJob = useAction(api.veoPosts.actions.createOrOpenJob);
  const [veoMatchUrl, setVeoMatchUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusLabels: Record<Doc<"veoPostJobs">["status"], string> = {
    pending: t("status.pending"),
    fetching: t("status.fetching"),
    processing: t("status.processing"),
    ready: t("status.ready"),
    failed: t("status.failed"),
  };

  const formatCreatedAt = (createdAt: number) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(createdAt));

  const handleGenerate = async () => {
    const trimmedUrl = veoMatchUrl.trim();
    if (!trimmedUrl) {
      showErrorToast(t("errors.invalidUrl"));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrOpenJob({ veoMatchUrl: trimmedUrl });
      if (result.reopened) {
        showSuccessToast(t("reopenedExisting"));
      }
      router.push(`/app/goal-highlights/${result.jobId}`);
    } catch (error) {
      showErrorToast(getGoalHighlightsErrorMessage(error, (key, values) => t(key, values)));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppPageHeader title={t("title")} description={t("description")} />

      <div className="space-y-8">
        <section className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="veo-match-url">{t("urlLabel")}</Label>
            <Input
              id="veo-match-url"
              type="url"
              inputMode="url"
              placeholder={t("urlPlaceholder")}
              value={veoMatchUrl}
              onChange={(event) => setVeoMatchUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleGenerate();
                }
              }}
            />
          </div>
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isSubmitting}
          >
            {isSubmitting ? t("generating") : t("generate")}
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            {t("historyTitle")}
          </h2>
          {jobs === undefined ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <JobHistoryList
              jobs={jobs}
              emptyLabel={t("historyEmpty")}
              statusLabels={statusLabels}
              formatCreatedAt={formatCreatedAt}
              goalCountLabel={(count) => t("goalCount", { count })}
            />
          )}
        </section>
      </div>
    </>
  );
}

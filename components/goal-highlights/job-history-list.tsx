"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";

import { JobStatusBadge } from "@/components/goal-highlights/job-status-badge";
import { Button } from "@/components/ui/button";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type JobSummary = {
  _id: Id<"veoPostJobs">;
  veoMatchSlug: string;
  veoMatchTitle: string | null;
  status: Doc<"veoPostJobs">["status"];
  goalCount: number | null;
  createdAt: number;
  expiresAt: number | null;
  hasVideo: boolean;
  videoExpired: boolean;
};

type JobHistoryListProps = {
  jobs: JobSummary[];
  emptyLabel: string;
  statusLabels: Record<Doc<"veoPostJobs">["status"], string>;
  videoExpiredLabel: string;
  formatCreatedAt: (createdAt: number) => string;
  formatExpiresAt: (expiresAt: number) => string;
  goalCountLabel: (count: number) => string;
  deleteLabel: string;
  onDeleteJob: (job: JobSummary) => void;
};

export function JobHistoryList({
  jobs,
  emptyLabel,
  statusLabels,
  videoExpiredLabel,
  formatCreatedAt,
  formatExpiresAt,
  goalCountLabel,
  deleteLabel,
  onDeleteJob,
}: JobHistoryListProps) {
  if (jobs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {jobs.map((job) => {
        const title = job.veoMatchTitle ?? job.veoMatchSlug;
        const metaParts = [formatCreatedAt(job.createdAt)];
        if (job.goalCount !== null) {
          metaParts.push(goalCountLabel(job.goalCount));
        }
        if (job.hasVideo && job.expiresAt !== null) {
          metaParts.push(formatExpiresAt(job.expiresAt));
        }
        if (job.videoExpired) {
          metaParts.push(videoExpiredLabel);
        }

        return (
          <li key={job._id}>
            <div className="flex items-center gap-2 px-4 py-3">
              <Link
                href={`/app/goal-highlights/${job._id}`}
                className="min-w-0 flex-1 transition-colors hover:opacity-80"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metaParts.join(" · ")}
                    </p>
                  </div>
                  <JobStatusBadge
                    status={job.status}
                    label={statusLabels[job.status]}
                  />
                </div>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={deleteLabel}
                onClick={() => onDeleteJob(job)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

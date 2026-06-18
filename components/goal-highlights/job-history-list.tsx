import Link from "next/link";

import { JobStatusBadge } from "@/components/goal-highlights/job-status-badge";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type JobSummary = {
  _id: Id<"veoPostJobs">;
  veoMatchSlug: string;
  veoMatchTitle: string | null;
  status: Doc<"veoPostJobs">["status"];
  goalCount: number | null;
  createdAt: number;
};

type JobHistoryListProps = {
  jobs: JobSummary[];
  emptyLabel: string;
  statusLabels: Record<Doc<"veoPostJobs">["status"], string>;
  formatCreatedAt: (createdAt: number) => string;
  goalCountLabel: (count: number) => string;
};

export function JobHistoryList({
  jobs,
  emptyLabel,
  statusLabels,
  formatCreatedAt,
  goalCountLabel,
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
      {jobs.map((job) => (
        <li key={job._id}>
          <Link
            href={`/app/goal-highlights/${job._id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {job.veoMatchTitle ?? job.veoMatchSlug}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCreatedAt(job.createdAt)}
                {job.goalCount !== null ? ` · ${goalCountLabel(job.goalCount)}` : null}
              </p>
            </div>
            <JobStatusBadge status={job.status} label={statusLabels[job.status]} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

type JobStatus = Doc<"veoPostJobs">["status"];

const statusVariant: Record<
  JobStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  fetching: "secondary",
  processing: "secondary",
  ready: "default",
  failed: "destructive",
};

type JobStatusBadgeProps = {
  status: JobStatus;
  label: string;
  className?: string;
};

export function JobStatusBadge({ status, label, className }: JobStatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]} className={cn(className)}>
      {label}
    </Badge>
  );
}

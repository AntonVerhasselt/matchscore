"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-36" />
        <div className="flex gap-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px border bg-border">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={`head-${index}`} className="h-8 rounded-none" />
        ))}
        {Array.from({ length: 42 }).map((_, index) => (
          <div
            key={`cell-${index}`}
            className="min-h-24 space-y-1.5 bg-background p-2"
          >
            <Skeleton className="ml-auto h-4 w-5" />
            {index % 5 === 0 ? <Skeleton className="h-6 w-full" /> : null}
            {index % 7 === 2 ? <Skeleton className="h-6 w-full" /> : null}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={`row-${index}`} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

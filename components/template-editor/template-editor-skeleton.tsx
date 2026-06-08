import { Skeleton } from "@/components/ui/skeleton";

export function TemplateEditorSkeleton() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <div className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-48" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
      <div className="flex flex-1">
        <Skeleton className="hidden w-60 shrink-0 md:block" />
        <Skeleton className="flex-1" />
        <Skeleton className="hidden w-72 shrink-0 md:block" />
      </div>
    </div>
  );
}

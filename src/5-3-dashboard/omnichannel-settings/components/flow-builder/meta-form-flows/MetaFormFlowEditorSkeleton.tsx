import { Skeleton } from "@/shared/components/ui/skeleton";

export function MetaFormFlowEditorSkeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Loading flow editor">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Skeleton className="min-h-[480px] w-full" />
        <Skeleton className="min-h-[480px] w-full" />
      </div>
    </div>
  );
}

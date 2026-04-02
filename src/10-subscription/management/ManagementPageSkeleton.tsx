import { Skeleton } from "@/shared/components/ui/skeleton";

export function ManagementPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={`pending-skeleton-${i}`} className="rounded-md border border-border p-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="mt-2 h-3 w-28" />
              <div className="mt-3 flex gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`history-row-skeleton-${i}`} className="grid grid-cols-4 gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

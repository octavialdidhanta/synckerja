import { Skeleton } from "@/shared/components/ui/skeleton";
import { ApplicationsPageSkeletonFrame } from "../layout/ApplicationsPageSkeletonFrame";

/**
 * Mirrors ApplicationsPageWrapper + ApplicationsPage: header, filters, table card, footer.
 */
export function ApplicationsPageSkeleton() {
  return (
    <ApplicationsPageSkeletonFrame>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="min-w-[960px]">
          <div className="border-b border-border bg-muted/50">
            <div className="flex gap-2 px-6 py-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-20 shrink-0" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-border bg-card">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 px-6 py-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                  <Skeleton className="h-3 w-36 max-w-full" />
                </div>
                <Skeleton className="h-4 w-32 shrink-0" />
                <Skeleton className="h-4 w-16 shrink-0" />
                <Skeleton className="h-4 w-28 shrink-0" />
                <div className="hidden min-w-[120px] flex-1 space-y-1 md:block">
                  <Skeleton className="h-3 w-full max-w-[200px]" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
                <div className="shrink-0 space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ApplicationsPageSkeletonFrame>
  );
}

import { Skeleton } from "@/shared/components/ui/skeleton";
import { OkrPageSkeletonFrame } from "../layout/OkrPageSkeletonFrame";

/**
 * Mirrors `/okr/individual-objective`: HeaderAndTab, progress card, employee list, sidebar + footers.
 */
export function IndividualObjectivePageSkeleton() {
  return (
    <OkrPageSkeletonFrame
      ariaLabel="Loading individual objectives"
      sidebarBody={
        <div className="h-full min-h-0 space-y-4 p-4">
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      }
    >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
        <div className="shrink-0 space-y-3">
          <div className="relative z-10 rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                  <Skeleton className="h-5 w-48 max-w-[70%] sm:w-56" />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="space-y-3 border-t border-border p-3">
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-14 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
              </div>
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          </div>
        </div>

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-h-0 flex-1 space-y-2 pb-1">
            {[0, 1, 2].map((k) => (
              <div key={k} className="w-full rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Skeleton className="h-4 w-4 shrink-0" />
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <Skeleton className="h-4 w-40 max-w-full" />
                        <Skeleton className="h-3 w-32 max-w-full" />
                      </div>
                      <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
                    </div>
                    <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </OkrPageSkeletonFrame>
  );
}

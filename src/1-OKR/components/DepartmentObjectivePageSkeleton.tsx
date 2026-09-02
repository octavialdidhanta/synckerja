import { Skeleton } from "@/shared/components/ui/skeleton";
import { OkrPageSkeletonFrame } from "../layout/OkrPageSkeletonFrame";

/**
 * Mirrors `/okr/department-objective`: HeaderAndTab, 9+3 grid, progress card, list, sidebar + footers.
 */
export function DepartmentObjectivePageSkeleton() {
  return (
    <OkrPageSkeletonFrame ariaLabel="Loading department objectives">
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
        <div className="shrink-0 space-y-3">
          <div className="relative z-10 rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Skeleton className="h-5 w-5 shrink-0 rounded" />
                  <Skeleton className="h-5 w-56 max-w-[55%]" />
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-8 w-36 max-w-[40vw]" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            </div>
            <div className="p-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
            <div className="space-y-3 border-t border-border p-3">
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-14 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
              </div>
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </div>
        </div>

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 w-full flex-1 flex-col basis-0 space-y-3 overflow-x-hidden overflow-y-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Skeleton className="h-14 w-full shrink-0 rounded-lg" />
          <Skeleton className="min-h-[8rem] w-full flex-1 rounded-lg" />
          <Skeleton className="h-28 w-full shrink-0 rounded-lg" />
        </div>
      </div>
    </OkrPageSkeletonFrame>
  );
}

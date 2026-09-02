import { Skeleton } from "@/shared/components/ui/skeleton";
import { OkrPageSkeletonFrame } from "../layout/OkrPageSkeletonFrame";

/**
 * Mirrors OKRPage company tab: HeaderAndTab, 9+3 grid, progress card, detail list, sidebar + footers.
 */
export function CompanyObjectivePageSkeleton() {
  return (
    <OkrPageSkeletonFrame ariaLabel="Loading OKR company objectives">
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
        <div className="shrink-0 space-y-3">
          <div className="relative z-10 rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 shrink-0 rounded" />
                  <Skeleton className="h-5 w-48 max-w-[70%]" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-[140px] rounded-md" />
                  <Skeleton className="h-8 w-28 rounded-md" />
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

import { Skeleton } from "@/shared/components/ui/skeleton";
import { OverviewPageSkeleton } from "@/10-subscription/overview/OverviewPageSkeleton";

/**
 * Guard / Suspense fallback untuk `/subscription/overview`: mirror `SubscriptionSectionLayout`
 * + konten `OverviewPage` (hindari skeleton generik menempel ke app sidebar).
 */
export function SubscriptionOverviewRouteLoadingShell() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="shrink-0 px-4">
          <div className="px-1 py-3">
            <div className="mb-3">
              <Skeleton className="h-7 w-56 max-w-full" />
              <Skeleton className="mt-2 h-3 w-80 max-w-full" />
            </div>
            <div className="-mb-3 flex space-x-6">
              <Skeleton className="h-8 w-28 rounded-none" />
              <Skeleton className="h-8 w-24 rounded-none" />
              <Skeleton className="h-8 w-32 rounded-none" />
            </div>
          </div>
        </div>

        <div className="box-border flex min-w-0 w-full max-w-full flex-col px-4 pb-2 pt-1">
          <OverviewPageSkeleton />
        </div>
      </div>
    </div>
  );
}

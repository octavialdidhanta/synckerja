import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  SALES_OPS_MAIN_COLUMN,
  SALES_OPS_MAIN_GRID,
  SALES_OPS_SIDEBAR_COLUMN,
} from '@/5-2-activities/layout/salesOperationsLayout';

function CustomerVisitsHeaderAndTabSkeleton() {
  return (
    <div className="px-1 py-3">
      <div className="mb-3 space-y-2">
        <Skeleton className="h-7 w-[min(100%,18rem)] max-w-full rounded-md" />
        <Skeleton className="h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
      </div>
      <div className="-mb-3">
        <nav className="flex space-x-6" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-1.5 border-b-2 border-transparent px-1 py-1.5">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-24 rounded-sm sm:w-28" />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function CustomerVisitsPageSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-surface-muted font-sans"
      aria-busy
      aria-label="Loading customer visits"
    >
      <span className="sr-only">Loading customer visits</span>
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col">
          <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full w-full min-w-0 max-w-full flex-col">
              <div className="mb-1 w-full min-w-0 max-w-full shrink-0">
                <CustomerVisitsHeaderAndTabSkeleton />
              </div>
              <div className={`${SALES_OPS_MAIN_GRID} min-h-[calc(100vh-120px)] flex-1`}>
                <div className={`${SALES_OPS_MAIN_COLUMN} flex h-full min-h-0 flex-col gap-2`}>
                  <div className="rounded-md border border-gray-200 bg-white p-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Skeleton className="h-5 w-28 rounded-sm" />
                      <Skeleton className="h-9 w-36 rounded-md" />
                      <Skeleton className="h-9 min-w-[160px] flex-1 rounded-md" />
                      <Skeleton className="h-9 w-24 rounded-md" />
                    </div>
                  </div>
                  <div className="rounded-md border border-gray-200 bg-white p-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Skeleton className="h-9 min-w-[150px] flex-1 rounded-md" />
                      <Skeleton className="h-9 w-36 rounded-md" />
                      <Skeleton className="h-9 w-36 rounded-md" />
                      <Skeleton className="h-9 w-36 rounded-md" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="rounded-md border border-gray-200 bg-gray-50/90 p-4">
                        <Skeleton className="mb-3 h-4 w-24" />
                        <Skeleton className="h-8 w-12" />
                      </div>
                    ))}
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
                      <div className="p-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <Skeleton key={i} className="mb-3 h-8 w-full" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className={SALES_OPS_SIDEBAR_COLUMN}>
                  <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="border-b px-4 py-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-2 h-3 w-40" />
                    </div>
                    <div className="flex-1 space-y-2 p-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                    <div className="space-y-2 border-t bg-gray-50 px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

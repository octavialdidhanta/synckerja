import { Skeleton } from "@/shared/components/ui/skeleton";

/** Mirrors `HeaderAndTab.tsx` (px-1 py-3, title, nav). */
function SalesActivitiesHeaderAndTabSkeleton() {
  return (
    <div className="px-1 py-3">
      <div className="mb-3 space-y-2">
        <Skeleton className="h-7 w-[min(100%,18rem)] max-w-full rounded-md" />
        <Skeleton className="h-3 w-[min(100%,22rem)] max-w-full rounded-sm" />
      </div>
      <div className="-mb-3">
        <nav className="flex space-x-6" aria-hidden>
          {[1, 2, 3].map((i) => (
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

function SalesActivitiesFiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Skeleton className="h-9 min-w-[150px] flex-1 rounded-md" />
      <Skeleton className="h-9 w-36 shrink-0 rounded-md sm:w-40" />
      <Skeleton className="h-9 w-36 shrink-0 rounded-md sm:w-40" />
      <Skeleton className="h-9 w-36 shrink-0 rounded-md sm:w-40" />
      <Skeleton className="h-9 w-36 shrink-0 rounded-md sm:w-40" />
      <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
      <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
    </div>
  );
}

function SalesActivitiesMetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-gray-50/90 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-sm" />
            <Skeleton className="h-5 w-5 shrink-0 rounded-sm" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-16 rounded-sm" />
            <Skeleton className="h-3 w-24 rounded-sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

const TABLE_COLS = 9;
const TABLE_ROWS = 8;

function SalesActivitiesTableSkeleton() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="scrollbar-hide min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full caption-bottom text-sm">
          <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <tr className="hover:bg-transparent">
              {Array.from({ length: TABLE_COLS }).map((_, i) => (
                <th key={i} className="bg-gray-50 px-3 py-2.5 text-left">
                  <Skeleton className="h-3 w-[70%] rounded-sm" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: TABLE_ROWS }).map((_, r) => (
              <tr key={r} className="h-12 border-b border-gray-100">
                {Array.from({ length: TABLE_COLS }).map((_, c) => (
                  <td key={c} className="px-3 py-2">
                    <Skeleton className="h-4 w-[85%] rounded-sm" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
        <Skeleton className="h-4 w-40 rounded-sm" />
        <Skeleton className="h-4 w-32 rounded-sm" />
      </div>
    </div>
  );
}

function SalesActivitiesOverviewSidebarSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-3 w-24 rounded-sm" />
              <Skeleton className="h-6 w-16 rounded-sm" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-sm" />
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors `/operations/sales/jadwal-kunjungan`: `SalesOperationsSeamlessSubpageLayout` shell + grid.
 */
export function SalesActivitiesPageSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-surface-muted font-sans"
      aria-busy
      aria-label="Loading sales activities"
    >
      <span className="sr-only">Loading sales activities</span>
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full w-full min-w-0 max-w-full flex-col">
              <div className="mb-1 w-full min-w-0 max-w-full shrink-0">
                <SalesActivitiesHeaderAndTabSkeleton />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full max-w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col">
                  <div className="grid min-h-0 min-w-0 w-full max-w-full flex-1 grid-cols-12 gap-2">
                    <div className="col-span-12 flex h-full min-h-0 min-w-0 w-full max-w-full flex-col lg:col-span-9">
                      <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col">
                        <div className="mb-2 flex-shrink-0">
                          <div className="rounded-md border border-gray-200 bg-white p-2">
                            <SalesActivitiesFiltersSkeleton />
                          </div>
                        </div>
                        <div className="mb-2 flex-shrink-0">
                          <SalesActivitiesMetricsSkeleton />
                        </div>
                        <div className="flex h-full min-h-0 flex-1">
                          <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                            <SalesActivitiesTableSkeleton />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-12 flex h-full min-h-0 min-w-0 w-full max-w-full flex-col lg:col-span-3">
                      <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col">
                        <div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                          <div className="flex-shrink-0 border-b px-4 py-1.5">
                            <div className="min-w-0 space-y-2">
                              <Skeleton className="h-4 w-48 max-w-full rounded-sm" />
                              <Skeleton className="h-3 w-40 max-w-full rounded-sm" />
                            </div>
                          </div>
                          <div className="scrollbar-hide flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4">
                            <SalesActivitiesOverviewSidebarSkeleton />
                          </div>
                          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-2">
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-3 w-20 rounded-sm" />
                              <Skeleton className="h-3 w-16 rounded-sm" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

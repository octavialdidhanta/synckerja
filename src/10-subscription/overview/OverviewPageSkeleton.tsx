import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Layout mirror untuk `/subscription/overview` — selaras `OverviewTabContent`
 * (grid 9+3, header py-2, scroll body, footer, quick summary sidebar).
 */
export function OverviewPageSkeleton() {
  return (
    <div className="grid min-h-[calc(100dvh-210px)] w-full min-w-0 max-w-full flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[760px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[860px]">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col md:col-span-9">
        <div className="flex max-md:min-h-[360px] min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="mt-2 h-3 w-72 max-w-full" />
          </div>

          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="min-w-0 space-y-5 p-4">
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="space-y-3 border-b border-border p-6 pb-4">
                  <Skeleton className="h-5 w-52 max-w-full" />
                  <Skeleton className="h-3 w-40 max-w-full" />
                </div>
                <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full max-w-[200px]" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-full max-w-[180px]" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Skeleton className="h-6 w-48 max-w-full" />
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Skeleton className="h-4 w-28 max-w-full" />
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </div>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={`overview-metric-skeleton-${i}`}
                      className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-3 w-24 max-w-full" />
                          <Skeleton className="h-7 w-20 max-w-full" />
                        </div>
                        <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 w-full min-w-0 rounded-lg" />
                <Skeleton className="h-64 w-full min-w-0 rounded-lg" />
              </div>
            </div>

            <div className="min-w-0 px-4 pb-4 pt-1">
              <div className="grid min-w-0 grid-cols-1 gap-1.5 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`overview-usage-skeleton-${i}`}
                    className="rounded-lg border border-border bg-card p-2.5"
                  >
                    <div className="space-y-2 text-center">
                      <Skeleton className="mx-auto h-8 w-14" />
                      <Skeleton className="mx-auto h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-10 min-w-0 flex-shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2">
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <Skeleton className="h-3 w-40 max-w-[55%]" />
              <Skeleton className="h-7 w-20 shrink-0 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 flex min-h-0 min-w-0 flex-col md:col-span-3">
        <div className="flex max-md:min-h-[280px] min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex-shrink-0 border-b border-border px-4 py-2">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="mt-2 h-3 w-40 max-w-full" />
          </div>

          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={`overview-sidebar-row-skeleton-${i}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-24 max-w-full" />
                      <Skeleton className="h-4 w-16 max-w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-10 min-w-0 flex-shrink-0 items-center border-t border-border bg-muted/40 px-4 py-2">
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <Skeleton className="h-3 w-28 max-w-[45%]" />
              <Skeleton className="h-3 w-24 max-w-[45%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

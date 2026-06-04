import { Skeleton } from "@/shared/components/ui/skeleton";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";

/**
 * Layout-matched skeleton for `/digital-marketing/report`.
 */
export function DigitalMarketingReportPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex flex-col gap-2">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="mt-2 h-3 w-64 max-w-full" />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Skeleton className="h-9 w-[14rem]" />
                      <Skeleton className="h-9 w-44" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        <Skeleton className="mb-1.5 h-3 w-16" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="space-y-0 border-b border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="flex gap-3">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-14" />
                      </div>
                    </div>
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="flex gap-3 border-b border-gray-100 px-3 py-3 last:border-0">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-14" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-10" />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-3 w-72 max-w-full" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-[11.5rem]" />
                        <Skeleton className="h-9 w-[5.5rem]" />
                      </div>
                    </div>
                    <Skeleton className="h-[300px] w-full rounded-md" />
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

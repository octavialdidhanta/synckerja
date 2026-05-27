import { Skeleton } from "@/shared/components/ui/skeleton";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";

export function GoogleAdsMetricsPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 min-w-0 shrink-0">
                  <HeaderAndTab />
                </div>
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
                  <div className="col-span-12 flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="shrink-0 border-b border-gray-200 p-4">
                      <Skeleton className="h-6 w-48" />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-9 w-56" />
                        <Skeleton className="h-9 w-32" />
                      </div>
                    </div>
                    <div className="flex-1 p-4">
                      <Skeleton className="h-[320px] w-full" />
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
    </div>
  );
}

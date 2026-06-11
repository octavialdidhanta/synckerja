import { Skeleton } from "@/shared/components/ui/skeleton";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";

export function GoogleAdsReportTargetsSettingsPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
                <div className="col-span-12">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="mt-1 h-3 w-full max-w-lg" />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Skeleton className="h-9 w-32" />
                      <Skeleton className="h-9 w-20" />
                      <Skeleton className="h-9 w-32" />
                      <Skeleton className="h-9 min-w-[12rem] flex-1 max-w-md" />
                    </div>
                    <Skeleton className="mt-4 h-12 w-full" />
                    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                      <div className="flex gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
                        {Array.from({ length: 6 }, (_, i) => (
                          <Skeleton key={i} className="h-4 flex-1 min-w-[3rem]" />
                        ))}
                      </div>
                      {Array.from({ length: 2 }, (_, i) => (
                        <Skeleton key={i} className="mx-3 my-2 h-[3.25rem] w-[calc(100%-1.5rem)]" />
                      ))}
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

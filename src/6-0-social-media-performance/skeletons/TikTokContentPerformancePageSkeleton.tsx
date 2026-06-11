import { Skeleton } from "@/shared/components/ui/skeleton";
import { SocialMediaPerformanceHeaderAndTab } from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";

export function TikTokContentPerformancePageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-1 min-w-0 shrink-0">
              <SocialMediaPerformanceHeaderAndTab />
            </div>
            <div className="grid min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
              <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="w-[180px] shrink-0 border-r border-gray-200 bg-gray-50/80">
                  <div className="border-b border-gray-200/80 px-3 py-3">
                    <Skeleton className="mb-2 h-2.5 w-16" />
                    <div className="space-y-1">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                  <div className="border-t border-gray-200/80 px-3 py-3">
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="shrink-0 border-b border-gray-200 p-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Skeleton className="h-9 w-9 shrink-0" />
                      <Skeleton className="h-9 w-56" />
                    </div>
                  </div>
                  <div className="shrink-0 border-b border-gray-100 px-4 pb-3 pt-1">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-md" />
                      ))}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden p-4">
                    <Skeleton className="h-full min-h-[200px] w-full" />
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

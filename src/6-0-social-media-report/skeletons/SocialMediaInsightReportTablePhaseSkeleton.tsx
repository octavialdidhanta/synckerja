import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
  SocialMediaPerformanceHeaderAndTab,
} from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";

export function SocialMediaInsightReportTablePhaseSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <SocialMediaPerformanceHeaderAndTab activeReportPath={SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH} />
              </div>
              <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="mt-0.5 h-3 w-full max-w-xl" />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Skeleton className="h-9 w-[11rem]" />
                      <Skeleton className="h-9 w-52" />
                      <Skeleton className="h-9 w-9" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="rounded-md border border-gray-200 bg-white px-3 py-2">
                      <Skeleton className="mb-1.5 h-3 w-16" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="space-y-0 p-0">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="mx-3 my-3 h-10 w-full" />
                    ))}
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

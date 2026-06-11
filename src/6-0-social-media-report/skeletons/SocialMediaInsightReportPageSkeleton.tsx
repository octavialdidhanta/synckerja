import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
  SocialMediaPerformanceHeaderAndTab,
} from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import { SocialMediaInsightReportChartsSkeleton } from "@/6-0-social-media-report/skeletons/SocialMediaInsightReportChartsSkeleton";

const CHART_TAB_WIDTHS = ["w-14", "w-16", "w-20", "w-28"] as const;

export function SocialMediaInsightReportPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <SocialMediaPerformanceHeaderAndTab activeReportPath={SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH} />
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
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
                        <Skeleton className="mt-2 h-1.5 w-full" />
                      </div>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="mx-3 my-3 h-10 w-full" />
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap gap-2">
                      {CHART_TAB_WIDTHS.map((w, i) => (
                        <Skeleton key={i} className={`h-8 ${w}`} />
                      ))}
                    </div>
                    <SocialMediaInsightReportChartsSkeleton />
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

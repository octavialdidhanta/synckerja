import {
  SOCIAL_MEDIA_PERFORMANCE_BASE_PATH,
  SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH,
  SocialMediaPerformanceHeaderAndTab,
} from "@/6-0-social-media-performance/container/SocialMediaPerformanceHeaderAndTab";
import { ModuleHeaderBelowContentGate } from "@/shared/layouts/ModuleHeaderBelowContentGate";
import { SocialMediaInsightReportTablePhaseSkeleton } from "@/6-0-social-media-report/skeletons/SocialMediaInsightReportTablePhaseSkeleton";

/**
 * Layout-matched skeleton for `/digital-marketing/social-media-performance/report`.
 * Mirrors the live shell + report body (filters, 6 KPIs, 12-col table, monthly charts).
 */
export function SocialMediaInsightReportPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 w-full flex-1 flex-col">
              <ModuleHeaderBelowContentGate
                pagePath={SOCIAL_MEDIA_PERFORMANCE_BASE_PATH}
                header={
                  <SocialMediaPerformanceHeaderAndTab
                    activeReportPath={SOCIAL_MEDIA_PERFORMANCE_REPORT_PATH}
                  />
                }
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                <SocialMediaInsightReportTablePhaseSkeleton />
              </ModuleHeaderBelowContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

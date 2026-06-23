import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  DAILY_TASK_REPORT_MAIN_GRID,
  DAILY_TASK_REPORT_MAIN_SCROLL,
  DAILY_TASK_REPORT_PERFORMANCE_CARD,
  DAILY_TASK_REPORT_SIDEBAR_CARD,
  DAILY_TASK_REPORT_TABLE_CARD,
} from "@/8-2-DailyTaskReport/layout/dailyTaskReportLayout";

const TOOLS_TABS = [
  { labelWidth: "w-20", active: false },
  { labelWidth: "w-32", active: true },
  { labelWidth: "w-24", active: false },
  { labelWidth: "w-24", active: false },
] as const;

/**
 * Mirrors live `/tools/daily-task-report` DOM:
 * shell → ToolsHeaderAndTab → grid 9+3 → overview → filters → table card → sidebar.
 */
export function DailyTaskReportPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("dailyTaskReport.page.loadingAria", "Loading daily task report");

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={DAILY_TASK_REPORT_MAIN_SCROLL}>
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              {/* Mirror ToolsHeaderAndTab */}
              <div className="mb-1 min-w-0 shrink-0">
                <div className="px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="mb-0.5 h-7 w-16 max-w-full" />
                    <Skeleton className="h-3 w-[min(100%,18rem)] max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <nav className="flex flex-wrap gap-x-6 gap-y-1">
                      {TOOLS_TABS.map((tab, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-1.5 border-b-2 px-1 py-1.5 ${
                            tab.active
                              ? "border-brand-blue/40"
                              : "border-transparent"
                          }`}
                        >
                          <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
                          <Skeleton className={`h-4 ${tab.labelWidth}`} />
                        </div>
                      ))}
                    </nav>
                  </div>
                </div>
              </div>

              {/* Mirror ModuleShellContentGate → page grid */}
              <div className={DAILY_TASK_REPORT_MAIN_GRID}>
                <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
                  <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
                    {/* OverviewCards */}
                    <div className="shrink-0">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-brand-blue/20 bg-white p-3 ring-1 ring-brand-blue/10"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-7 w-12" />
                            {i >= 4 ? (
                              <>
                                <Skeleton className="mt-2 h-3 w-full" />
                                <Skeleton className="mt-1 h-2.5 w-3/4" />
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Filters */}
                    <div className="shrink-0">
                      <div className="rounded-md border border-border bg-card p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Skeleton className="h-9 min-w-[150px] flex-1 sm:max-w-xs" />
                          <Skeleton className="h-9 w-full sm:w-32 lg:w-36" />
                          <Skeleton className="h-9 w-full sm:w-32 lg:w-36" />
                          <Skeleton className="h-9 w-full sm:w-36" />
                          <Skeleton className="h-9 w-full sm:w-36" />
                          <Skeleton className="h-9 w-full sm:w-36" />
                          <Skeleton className="h-9 w-full sm:w-36" />
                          <Skeleton className="ml-auto h-9 w-9 shrink-0 rounded-md" />
                        </div>
                      </div>
                    </div>

                    {/* PerformanceTable */}
                    <div className={DAILY_TASK_REPORT_TABLE_CARD}>
                      <div className={DAILY_TASK_REPORT_PERFORMANCE_CARD}>
                        <div className="shrink-0 border-b border-brand-blue/15 bg-brand-blue/[0.06] px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-4 w-44" />
                            <Skeleton className="h-7 w-36 rounded-md" />
                          </div>
                          <Skeleton className="mt-1 h-3 w-56" />
                        </div>
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <div className="sticky top-0 z-20 flex gap-3 border-b border-brand-blue/15 bg-brand-blue/[0.06] px-3 py-2 shadow-sm">
                            {["w-16", "w-20", "w-24", "w-14", "w-12", "w-14", "w-12"].map((w, i) => (
                              <Skeleton key={i} className={`h-3 shrink-0 ${w}`} />
                            ))}
                          </div>
                          <div className="space-y-0 divide-y divide-brand-blue/10">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                                <Skeleton className="h-4 w-20 shrink-0" />
                                <Skeleton className="h-4 min-w-0 flex-1" />
                                <Skeleton className="h-5 w-8 shrink-0 rounded-full" />
                                <Skeleton className="h-4 w-14 shrink-0" />
                                <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="relative z-10 shrink-0 border-t border-brand-blue/15 bg-brand-blue/[0.05] px-4 py-3 shadow-[0_-1px_3px_0_rgba(37,99,235,0.08)]">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-4">
                              <Skeleton className="h-3 w-16" />
                              <Skeleton className="h-3 w-28" />
                            </div>
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BlockersAndUpdatesPanel */}
                <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-3">
                  <div className={DAILY_TASK_REPORT_SIDEBAR_CARD}>
                    <div className="shrink-0 border-b border-brand-blue/15 bg-brand-blue/[0.06]">
                      <div className="flex w-full gap-0 p-0">
                        <div className="flex flex-1 items-center justify-center border-b-2 border-brand-blue/40 px-3 py-2">
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <div className="flex flex-1 items-center justify-center border-b-2 border-transparent px-3 py-2">
                          <Skeleton className="h-4 w-28" />
                        </div>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="rounded-md border border-brand-blue/20 bg-brand-blue/[0.04] p-2"
                        >
                          <Skeleton className="mb-2 h-3.5 w-32" />
                          <div className="ml-1 space-y-2 rounded-md border border-brand-blue/15 bg-white p-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-14 w-full rounded border border-red-200/80 bg-red-50/80" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="relative z-10 shrink-0 border-t border-brand-blue/15 bg-brand-blue/[0.05] px-4 py-3 shadow-[0_-1px_3px_0_rgba(37,99,235,0.08)]">
                      <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-20" />
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

import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { FINANCIAL_DRAWERS_LIST_SCROLL } from "@/4-1-dashboard/utils/financialDrawersScroll";

const GRID_MAIN =
  "min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch xl:grid-rows-1 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]";

/**
 * Mirrors `IncomeDashboard` — seamless scroll (header ikut scroll), `AppShell`-safe `h-full` root.
 */
export function IncomeDashboardSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("incomes.dashboard.loadingAria", "Loading income dashboard");
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 min-w-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              {/* HeaderAndTab: title + subtitle + two nav tabs */}
              <div className="mb-1 shrink-0 px-1 py-3">
                <div className="mb-3 space-y-1.5">
                  <Skeleton className="h-7 w-56 max-w-[90vw]" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </div>
                <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-44" />
                </div>
              </div>

              <div className={`grid ${GRID_MAIN}`}>
                <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
                  <div className="flex h-full min-w-0 flex-col">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-gray-200/50 bg-gradient-to-br from-gray-50 to-white p-2 xl:min-h-0">
                      {/* "Income Analytics" row + three selects */}
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Skeleton className="h-7 w-40" />
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-9 w-36" />
                          <Skeleton className="h-9 w-36" />
                          <Skeleton className="h-9 min-w-[200px] sm:w-52" />
                        </div>
                      </div>

                      {/* Total balance card (blue) */}
                      <Skeleton className="mb-2 h-[4.75rem] w-full shrink-0 rounded-lg bg-brand-blue/25" />

                      {/* Four metric cards */}
                      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm"
                          >
                            <Skeleton className="mb-2 h-3 w-24" />
                            <Skeleton className="h-8 w-28" />
                            <Skeleton className="mt-1 h-2 w-20" />
                          </div>
                        ))}
                      </div>

                      {/* Income distribution + monthly trend (two columns) */}
                      <div className="mb-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                        <div className="flex min-h-[240px] min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm">
                          <div className="mb-3 flex justify-between gap-2">
                            <Skeleton className="h-5 w-36" />
                            <Skeleton className="h-5 w-24" />
                          </div>
                          <Skeleton className="h-9 w-full max-w-[220px]" />
                          <Skeleton className="mt-3 min-h-[160px] w-full flex-1 rounded-md bg-muted/50" />
                        </div>
                        <div className="flex min-h-[240px] min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm">
                          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-9 w-20 shrink-0" />
                          </div>
                          <Skeleton className="min-h-[200px] w-full flex-1 rounded-md bg-muted/50" />
                          <Skeleton className="mt-2 h-3 w-24" />
                        </div>
                      </div>

                      {/* Income vs expenses + net per bank */}
                      <div className="mb-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                        <Skeleton className="min-h-[200px] w-full rounded-lg border border-gray-200/80 bg-white shadow-sm" />
                        <div className="flex min-h-[200px] min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm">
                          <Skeleton className="mb-1 h-5 w-52" />
                          <Skeleton className="mb-3 h-3 w-full max-w-sm" />
                          <div className={`space-y-2 ${FINANCIAL_DRAWERS_LIST_SCROLL}`}>
                            <Skeleton className="h-16 w-full rounded-md" />
                            <Skeleton className="h-16 w-full rounded-md" />
                            <Skeleton className="h-16 w-full rounded-md border border-dashed border-slate-300/60 bg-slate-50/50" />
                            <Skeleton className="h-16 w-full rounded-md border border-dashed border-slate-300/60 bg-slate-50/50" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Income sidebar */}
                <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-3">
                  <div className="flex h-full min-w-0 flex-col">
                    <div className="flex h-full min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                      <div className="shrink-0 border-b border-border px-4 py-1.5">
                        <Skeleton className="mb-1 h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <div className="min-h-0 flex-1">
                        <div className="h-full min-h-0 space-y-2 p-4">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-full rounded-md" />
                          ))}
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

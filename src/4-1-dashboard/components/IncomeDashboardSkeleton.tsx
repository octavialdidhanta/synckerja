import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  FINANCIAL_DRAWERS_LIST_SCROLL,
  INCOME_DRAWERS_PAIR_CARD_H,
  INCOME_DRAWERS_PAIR_GRID,
} from "@/4-1-dashboard/utils/financialDrawersScroll";
import {
  INCOME_DASHBOARD_MAIN_COLUMN,
  INCOME_DASHBOARD_MAIN_GRID,
  INCOME_DASHBOARD_RECENT_COLUMN,
  INCOME_DASHBOARD_RECENT_PANEL,
  INCOME_DASHBOARD_RECENT_PANEL_BODY,
  INCOME_DASHBOARD_RECENT_PANEL_SCROLL,
  INCOME_DASHBOARD_TABLE_SECTION,
} from "@/4-1-dashboard/layout/incomeDashboardLayout";

const GRID_MAIN = INCOME_DASHBOARD_MAIN_GRID;

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

/**
 * Mirrors `IncomeDashboard` + `IncomesModuleShell` — page scroll, tanpa spacer bawah ekstra.
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
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className={MAIN_SCROLL}>
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 flex-shrink-0 px-1 py-3">
                <div className="mb-3 space-y-1.5">
                  <Skeleton className="h-7 w-56 max-w-[90vw]" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </div>
                <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-44" />
                </div>
              </div>

              <div className={GRID_MAIN}>
                <div className={INCOME_DASHBOARD_MAIN_COLUMN}>
                  <div className={INCOME_DASHBOARD_TABLE_SECTION}>
                    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200/50 bg-gradient-to-br from-gray-50 to-white">
                      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Skeleton className="h-7 w-40" />
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-9 w-36" />
                          <Skeleton className="h-9 w-36" />
                          <Skeleton className="h-9 min-w-[200px] sm:w-52" />
                        </div>
                      </div>

                      <Skeleton className="mb-2 h-[4.75rem] w-full shrink-0 rounded-lg bg-brand-blue/25" />

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

                      <div className={INCOME_DRAWERS_PAIR_GRID}>
                        <Skeleton
                          className={`${INCOME_DRAWERS_PAIR_CARD_H} w-full rounded-lg border border-gray-200/80 bg-white shadow-sm`}
                        />
                        <div
                          className={`${INCOME_DRAWERS_PAIR_CARD_H} flex min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm`}
                        >
                          <Skeleton className="mb-1 h-5 w-52" />
                          <div className={`space-y-2 ${FINANCIAL_DRAWERS_LIST_SCROLL}`}>
                            <Skeleton className="h-[5.5rem] w-full rounded-md" />
                            <Skeleton className="h-[5.5rem] w-full rounded-md" />
                            <Skeleton className="h-[5.5rem] w-full rounded-md border border-dashed border-slate-300/60 bg-slate-50/50" />
                          </div>
                        </div>
                      </div>
                      </div>
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Skeleton className="h-3 w-52 max-w-[55%]" />
                          <Skeleton className="h-3 w-24 max-w-[40%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={INCOME_DASHBOARD_RECENT_COLUMN}>
                  <div className={INCOME_DASHBOARD_TABLE_SECTION}>
                    <div className={INCOME_DASHBOARD_RECENT_PANEL}>
                      <div className="shrink-0 border-b border-border px-4 py-1.5">
                        <Skeleton className="mb-1 h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <div className={INCOME_DASHBOARD_RECENT_PANEL_BODY}>
                        <div className={INCOME_DASHBOARD_RECENT_PANEL_SCROLL}>
                          <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Skeleton key={i} className="h-14 w-full rounded-md" />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                        <Skeleton className="h-3 w-full max-w-[200px]" />
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

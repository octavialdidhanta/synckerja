import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { ExpenseDashboardPageSkeletonFrame } from "@/4-2-dashboard/layout/ExpenseDashboardPageSkeletonFrame";
import { EXPENSE_DASHBOARD_MAIN_GRID, EXPENSE_DASHBOARD_TABLE_SECTION } from "@/4-2-dashboard/layout/expenseDashboardLayout";

export type ExpenseDashboardSkeletonProps = {
  /**
   * `full` — guard + Suspense (seluruh shell + HeaderAndTab + konten dashboard).
   * `embedded` — overlay area konten saja; mirror `ExpenseDashboard` di bawah header.
   */
  variant?: "full" | "embedded";
  className?: string;
};

function ExpenseDashboardQuickViewSkeleton() {
  return (
    <div className="min-w-0 shrink-0">
      <div className="w-full min-w-0 rounded-lg border-0 bg-brand-blue p-3 text-white shadow-sm">
        <div className="flex min-w-0 flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="mb-0 flex items-center gap-2">
              <Skeleton className="h-8 w-8 shrink-0 rounded-lg bg-white/20" />
              <Skeleton className="h-4 w-[min(220px,55vw)] max-w-xs rounded-md bg-white/25" />
            </div>
            <Skeleton className="h-8 w-28 rounded-md bg-white/35" />
          </div>
          <div className="min-w-0 shrink-0 space-y-1 sm:text-right">
            <Skeleton className="h-8 w-36 rounded-md bg-white/40 sm:ml-auto" />
            <Skeleton className="h-3 w-28 rounded-md bg-white/25 sm:ml-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseDashboardMetricCardSkeleton() {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200/80 bg-white shadow-sm">
      <div className="min-w-0 p-3">
        <Skeleton className="mb-1 h-3 w-28 max-w-full rounded-md" />
        <Skeleton className="mb-1 h-7 w-24 max-w-full rounded-md sm:h-8" />
        <Skeleton className="h-3 w-20 max-w-full rounded-md" />
        <div className="mt-1 flex items-center gap-1">
          <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function ExpenseDashboardBreakdownChartSkeleton() {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white shadow-sm">
      <div className="flex min-w-0 flex-1 flex-col p-3 pb-2 pt-3">
        <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
          <Skeleton className="h-5 w-40 max-w-[55vw] rounded-md" />
          <Skeleton className="h-5 w-24 shrink-0 rounded-md" />
        </div>
        <div className="mb-4 grid w-full grid-cols-2 gap-1 rounded-md bg-muted/60 p-1">
          <Skeleton className="h-9 rounded-md" />
          <Skeleton className="h-9 rounded-md bg-muted/80" />
        </div>
        <div className="flex min-h-[12rem] items-end justify-center gap-1 px-2 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <div className="flex h-48 w-full flex-col justify-end rounded bg-gray-100/90 p-1">
                <Skeleton
                  className="w-full rounded-t"
                  style={{ height: `${36 + (i % 3) * 18}%` }}
                />
              </div>
              <Skeleton className="h-3 w-full max-w-[3rem] rounded-md" />
              <Skeleton className="h-3 w-full max-w-[2.5rem] rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseDashboardMonthlyChartSkeleton() {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white shadow-sm">
      <div className="flex min-w-0 flex-1 flex-col p-3 pb-1 pt-3">
        <div className="mb-4 flex min-w-0 shrink-0 items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-5 w-44 max-w-[60vw] rounded-md" />
            <Skeleton className="h-3 w-52 max-w-full rounded-md" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
        </div>
        <Skeleton className="h-52 w-full min-w-0 shrink-0 rounded-md bg-muted/50" />
        <div className="mt-1 flex shrink-0 items-center">
          <Skeleton className="mr-2 h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function ExpenseDashboardSkeletonToolbar() {
  return (
    <>
      <ExpenseDashboardQuickViewSkeleton />

      <div className="min-w-0 shrink-0">
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ExpenseDashboardMetricCardSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className="min-w-0 shrink-0">
        <div className="grid min-w-0 grid-cols-1 gap-2 lg:grid-cols-2">
          <ExpenseDashboardBreakdownChartSkeleton />
          <ExpenseDashboardMonthlyChartSkeleton />
        </div>
      </div>
    </>
  );
}

function ExpenseDashboardSkeletonTable() {
  return (
    <>
      <div className="min-w-0 shrink-0 border-b border-border bg-muted/40 px-2 py-2 sm:px-3">
        <div className="flex min-w-0 flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-full min-w-[12rem] sm:w-56" />
            <Skeleton className="h-9 w-full sm:w-36 md:w-40" />
            <Skeleton className="h-9 w-full sm:w-36 md:w-40" />
            <Skeleton className="h-9 w-full sm:w-36 md:w-40" />
            <Skeleton className="h-9 w-full sm:w-40 md:w-44" />
            <Skeleton className="h-9 w-full sm:w-36 md:w-40" />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          </div>
          <Skeleton className="h-9 w-full shrink-0 sm:w-32" />
        </div>
      </div>

      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[1400px]">
          <div className="sticky top-0 z-10 flex gap-2 border-b border-border bg-gray-50 px-2 py-2 shadow-sm sm:px-4 sm:py-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20 shrink-0 rounded-md" />
            ))}
          </div>
          <div className="space-y-0 p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-2 border-b border-border/60 px-2 py-2.5 sm:px-4 sm:py-3"
              >
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-20 shrink-0 rounded-md" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Skeleton khusus `/expenses/dashboard` — mirror `ExpenseDashboard` + `HeaderAndTab`.
 */
export function ExpenseDashboardSkeleton({
  variant = "full",
  className,
}: ExpenseDashboardSkeletonProps = {}) {
  const { t } = useAppTranslation();
  const aria = t("expenses.dashboard.loadingAria", "Loading expense dashboard");

  if (variant === "embedded") {
    return (
      <div className={cn("min-h-0 w-full min-w-0", className)} aria-busy aria-label={aria}>
        <span className="sr-only">{aria}</span>
        <div className={EXPENSE_DASHBOARD_MAIN_GRID}>
          <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch">
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
              <ExpenseDashboardSkeletonToolbar />
              <div className={EXPENSE_DASHBOARD_TABLE_SECTION}>
                <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                  <ExpenseDashboardSkeletonTable />
                  <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3 w-40 max-w-[55%]" />
                      <Skeleton className="h-3 w-24 max-w-[40%]" />
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

  return (
    <ExpenseDashboardPageSkeletonFrame ariaLabel={aria} toolbar={<ExpenseDashboardSkeletonToolbar />}>
      <ExpenseDashboardSkeletonTable />
    </ExpenseDashboardPageSkeletonFrame>
  );
}

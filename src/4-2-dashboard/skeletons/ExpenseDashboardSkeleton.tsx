import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

/** Selaras `ExpenseDashboard` grid utama (Seamless Page Scroll). */
const EXPENSE_DASHBOARD_MAIN_GRID =
  "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]";

const SCROLL_MAIN =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

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

function ExpenseDashboardTableSkeleton() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
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

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain h-[min(32rem,calc(100vh-18rem))] max-h-[32rem] min-h-[14rem] min-w-0 shrink-0 overflow-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div className="border-t border-border px-3 py-2">
          <Skeleton className="h-4 w-56 max-w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}

function ExpenseDashboardSkeletonMain() {
  return (
    <div className={EXPENSE_DASHBOARD_MAIN_GRID}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
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

        <ExpenseDashboardTableSkeleton />
      </div>
    </div>
  );
}

function ExpenseDashboardHeaderSkeleton() {
  const tabWidths = ["w-[92px]", "w-[52px]", "w-[88px]", "w-[120px]", "w-[108px]"];

  return (
    <div className="mb-1 min-w-0 shrink-0 px-1 py-3">
      <div className="mb-3 min-w-0">
        <Skeleton className="h-7 w-[min(220px,50vw)] max-w-xs rounded-md" />
        <Skeleton className="mt-0.5 h-3 w-[min(420px,92vw)] max-w-2xl rounded-md" />
      </div>
      <div className="-mb-3 min-w-0">
        <nav className="flex min-w-0 space-x-2 overflow-x-auto sm:space-x-6" aria-hidden>
          {tabWidths.map((widthClass, i) => (
            <div
              key={i}
              className={cn(
                "flex shrink-0 items-center space-x-1 whitespace-nowrap border-b-2 py-1.5 sm:space-x-1.5 sm:px-2",
                i === 0 ? "border-brand-blue/40" : "border-transparent",
              )}
            >
              <Skeleton className="h-3 w-3 shrink-0 rounded-sm sm:h-4 sm:w-4" />
              <Skeleton className={cn("h-4 rounded-md", widthClass)} />
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

/**
 * Skeleton khusus `/expenses/dashboard` — mirror `ExpenseDashboard` + `HeaderAndTab`.
 * Dipakai `PageAccessGuard`, Suspense fallback, dan overlay data fetch awal (`variant="embedded"`).
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
        <ExpenseDashboardSkeletonMain />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans",
        className,
      )}
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className={SCROLL_MAIN}>
            <div className="flex min-h-full w-full min-w-0 flex-col bg-muted/40">
              <ExpenseDashboardHeaderSkeleton />
              <ExpenseDashboardSkeletonMain />
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

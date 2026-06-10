import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

/** Selaras `ExpenseDashboard` grid utama (Seamless Page Scroll). */
const EXPENSE_DASHBOARD_MAIN_GRID =
  "grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]";

/**
 * Skeleton khusus `/expenses/dashboard` — dipakai `PageAccessGuard` `loadingShell`, Suspense fallback, dan overlay data.
 */
export function ExpenseDashboardSkeleton() {
  const { t } = useAppTranslation();
  const aria = t("expenses.dashboard.loadingAria", "Loading expense dashboard");
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-full min-h-0 flex-1 flex-col bg-muted/40">
              {/* HeaderAndTab: judul + 5 tab seperti live page */}
              <div className="mb-1 shrink-0 px-1 py-3">
                <div className="mb-3 min-w-0 space-y-1.5">
                  <Skeleton className="h-7 w-56 max-w-[90vw]" />
                  <Skeleton className="h-3 w-full max-w-xl" />
                </div>
                <div className="-mb-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 sm:gap-x-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className={cn("h-9 shrink-0", i === 0 ? "w-36 sm:w-40" : "w-24 sm:w-28")} />
                  ))}
                </div>
              </div>

              <div className={EXPENSE_DASHBOARD_MAIN_GRID}>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {/* Quick View balance (biru) */}
            <Skeleton className="h-28 w-full shrink-0 rounded-lg bg-brand-blue/25 md:h-32" />

            {/* Empat kartu metrik */}
            <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm"
                >
                  <Skeleton className="mb-2 h-3 w-28" />
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="mt-2 h-2 w-16" />
                </div>
              ))}
            </div>

            {/* Dua kartu chart */}
            <div className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-2">
              <div className="flex min-h-[240px] min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm">
                <div className="mb-3 flex justify-between gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-9 w-full max-w-[220px]" />
                <Skeleton className="mt-3 min-h-[160px] flex-1 w-full rounded-md bg-muted/50" />
              </div>
              <div className="flex min-h-[240px] min-w-0 flex-col rounded-lg border border-gray-200/80 bg-white p-3 shadow-sm">
                <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-9 w-20 shrink-0" />
                </div>
                <Skeleton className="min-h-[200px] flex-1 w-full rounded-md bg-muted/50" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            </div>

            {/* Kartu tabel: dua lapisan selaras live (flex-1 isi sisa tinggi) */}
            <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
              <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <div className="shrink-0 border-b border-border bg-muted/40 px-2 py-2 sm:px-3">
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <Skeleton className="h-9 w-full min-w-[12rem] sm:w-56" />
                      <Skeleton className="h-9 w-36" />
                      <Skeleton className="h-9 w-36" />
                      <Skeleton className="h-9 w-36" />
                      <Skeleton className="h-9 w-36" />
                      <Skeleton className="h-9 w-9 shrink-0" />
                    </div>
                    <Skeleton className="h-9 w-full shrink-0 sm:w-32" />
                  </div>
                </div>
                <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-auto space-y-2 p-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-md" />
                  ))}
                </div>
                <div className="border-t border-border px-3 py-2">
                  <Skeleton className="h-4 w-48" />
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

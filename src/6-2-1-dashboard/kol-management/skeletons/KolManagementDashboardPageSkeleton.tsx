import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export type KolManagementDashboardPageSkeletonProps = {
  /**
   * `full` — guard + Suspense (seluruh shell + HeaderAndTab + konten dashboard).
   * `embedded` — overlay di area konten saja; struktur kartu sama dengan `EnhancedKOLDashboard`.
   */
  variant?: "full" | "embedded";
  className?: string;
};

/**
 * Skeleton khusus `/kol-management/dashboard` — mirror `KolManagementDashboardPage` + `EnhancedKOLDashboard`.
 * Dipakai `PageAccessGuard`, `Suspense` fallback, dan overlay data fetch awal (`variant="embedded"`).
 */
function KolManagementDashboardSkeletonMain() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-primary/20 bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6">
          <div className="mb-6 border-b border-primary/15 pb-4">
            <Skeleton className="h-6 w-[min(320px,70vw)] max-w-md rounded-md bg-brand-blue-soft/80" />
            <Skeleton className="mt-2 h-4 w-[min(420px,92vw)] max-w-2xl rounded-md bg-brand-blue-soft/60" />
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`kpi-${i}`}
                  className="rounded-lg border border-primary/15 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-24 rounded-md bg-brand-blue-soft/70" />
                      <Skeleton className="h-8 w-28 rounded-md bg-brand-blue-soft/80" />
                      <Skeleton className="h-3 w-16 rounded-md bg-brand-blue-soft/60" />
                    </div>
                    <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-brand-blue-soft/90" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={`sec-${i}`}
                  className="rounded-lg border border-primary/15 bg-brand-blue-soft/40 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-28 rounded-md bg-brand-blue-soft/70" />
                      <Skeleton className="h-7 w-20 rounded-md bg-brand-blue-soft/80" />
                      <Skeleton className="h-3 w-32 rounded-md bg-brand-blue-soft/60" />
                    </div>
                    <Skeleton className="h-5 w-5 shrink-0 rounded-md bg-brand-blue-soft/90" />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-primary/20 bg-white shadow-sm">
              <div className="border-b border-primary/15 bg-brand-blue-soft/35 px-6 pb-4 pt-6">
                <Skeleton className="h-5 w-40 rounded-md bg-brand-blue-soft/80" />
              </div>
              <div className="px-6 pb-6 pt-6">
                <div className="flex w-full max-w-xl flex-wrap gap-2 sm:inline-flex sm:max-w-none">
                  <Skeleton className="h-9 flex-1 rounded-md bg-brand-blue-soft/70 sm:w-24" />
                  <Skeleton className="h-9 flex-1 rounded-md bg-brand-blue-soft/70 sm:w-28" />
                  <Skeleton className="h-9 flex-1 rounded-md bg-brand-blue-soft/70 sm:w-28" />
                </div>
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-lg border border-primary/20 p-4 shadow-sm">
                    <Skeleton className="h-5 w-48 rounded-md bg-brand-blue-soft/80" />
                    <Skeleton className="mt-4 h-[300px] w-full rounded-md bg-brand-blue-soft/50" />
                  </div>
                  <div className="rounded-lg border border-primary/20 p-4 shadow-sm">
                    <Skeleton className="h-5 w-44 rounded-md bg-brand-blue-soft/80" />
                    <Skeleton className="mt-4 h-[300px] w-full rounded-md bg-brand-blue-soft/50" />
                  </div>
                </div>
                <div className="mt-6 space-y-0 rounded-lg border border-primary/20 p-4 shadow-sm">
                  <Skeleton className="h-5 w-56 rounded-md bg-brand-blue-soft/80" />
                  <div className="mt-4 divide-y divide-primary/10">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div key={j} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-[min(240px,70vw)] rounded-md bg-brand-blue-soft/70" />
                          <Skeleton className="h-3 w-48 rounded-md bg-brand-blue-soft/60" />
                        </div>
                        <div className="shrink-0 space-y-2 text-right">
                          <Skeleton className="ml-auto h-4 w-12 rounded-md bg-brand-blue-soft/80" />
                          <Skeleton className="ml-auto h-3 w-20 rounded-md bg-brand-blue-soft/60" />
                        </div>
                      </div>
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

export function KolManagementDashboardPageSkeleton({
  variant = "full",
  className,
}: KolManagementDashboardPageSkeletonProps) {
  if (variant === "embedded") {
    return (
      <div
        className={cn("min-h-0 w-full min-w-0", className)}
        aria-busy
        aria-label="Loading KOL dashboard"
      >
        <span className="sr-only">Loading KOL dashboard</span>
        <KolManagementDashboardSkeletonMain />
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
      aria-label="Loading KOL dashboard"
    >
      <span className="sr-only">Loading KOL dashboard</span>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col px-4 pb-2">
            <div className="flex min-h-full flex-1 flex-col">
              <div className="mb-1 flex-shrink-0 px-1 py-3">
                <div className="mb-3">
                  <Skeleton className="h-7 w-[min(280px,55vw)] max-w-sm rounded-md" />
                  <Skeleton className="mt-2 h-3 w-[min(360px,85vw)] max-w-md rounded-md" />
                </div>
                <div className="-mb-3">
                  <nav className="flex flex-wrap gap-x-4 gap-y-2 sm:space-x-6 sm:gap-x-0" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-[100px] rounded-none sm:w-[112px]" />
                    ))}
                  </nav>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
                <KolManagementDashboardSkeletonMain />
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
  );
}

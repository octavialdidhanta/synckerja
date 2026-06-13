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

function KolDashboardSectionTitleSkeleton({ widthClass }: { widthClass: string }) {
  return (
    <div className="border-l-4 border-primary/30 pl-2.5">
      <Skeleton className={cn("h-4 rounded-md bg-brand-blue-soft/80", widthClass)} />
    </div>
  );
}

function KolDashboardKpiCardSkeleton({ variant }: { variant: "primary" | "secondary" }) {
  const isPrimary = variant === "primary";
  return (
    <div
      className={cn(
        "rounded-lg border border-primary/15 shadow-sm",
        isPrimary ? "bg-white" : "bg-brand-blue-soft/40",
      )}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-3 w-[72px] max-w-full rounded-md bg-brand-blue-soft/70" />
            <Skeleton
              className={cn(
                "rounded-md bg-brand-blue-soft/85",
                isPrimary ? "h-7 w-24" : "h-6 w-20",
              )}
            />
            <Skeleton className="h-3 w-12 rounded-md bg-brand-blue-soft/60" />
          </div>
          {isPrimary ? (
            <Skeleton className="h-7 w-7 shrink-0 rounded-full bg-brand-blue-soft/90" />
          ) : (
            <Skeleton className="h-4 w-4 shrink-0 rounded-md bg-brand-blue-soft/80" />
          )}
        </div>
      </div>
    </div>
  );
}

function KolDashboardChartCardSkeleton({ titleWidthClass }: { titleWidthClass: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 shadow-sm">
      <div className="space-y-0 border-b border-primary/10 bg-brand-blue-soft/30 px-4 py-2">
        <KolDashboardSectionTitleSkeleton widthClass={titleWidthClass} />
      </div>
      <div className="p-3 pt-3 sm:p-4">
        <Skeleton className="h-[240px] w-full rounded-md bg-brand-blue-soft/45" />
      </div>
    </div>
  );
}

function KolDashboardCampaignRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-[min(220px,55vw)] max-w-full rounded-md bg-brand-blue-soft/75" />
        <Skeleton className="h-3 w-40 max-w-full rounded-md bg-brand-blue-soft/55" />
      </div>
      <div className="shrink-0 space-y-1 text-right">
        <Skeleton className="ml-auto h-4 w-10 rounded-md bg-brand-blue-soft/80" />
        <Skeleton className="ml-auto h-3 w-24 rounded-md bg-brand-blue-soft/55" />
      </div>
    </div>
  );
}

/**
 * Skeleton khusus `/kol-management/dashboard` — mirror `KolManagementDashboardPage` + `EnhancedKOLDashboard`.
 * Dipakai `PageAccessGuard`, `Suspense` fallback, dan overlay data fetch awal (`variant="embedded"`).
 */
function KolManagementDashboardSkeletonMain() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="relative col-span-12 flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-primary/20 bg-white px-3 py-3 shadow-sm sm:px-4 sm:py-4">
          <div className="mb-3 border-b border-primary/15 pb-2">
            <div className="border-l-4 border-primary/30 pl-2.5">
              <Skeleton className="h-5 w-44 max-w-full rounded-md bg-brand-blue-soft/85" />
            </div>
            <Skeleton className="mt-0.5 ml-2.5 h-3 w-[min(420px,92vw)] max-w-2xl rounded-md bg-brand-blue-soft/60" />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <KolDashboardKpiCardSkeleton key={`kpi-primary-${i}`} variant="primary" />
              ))}
              {Array.from({ length: 4 }).map((_, i) => (
                <KolDashboardKpiCardSkeleton key={`kpi-secondary-${i}`} variant="secondary" />
              ))}
            </div>

            <div className="w-full">
              <div className="grid w-full max-w-xl grid-cols-3 gap-1 rounded-md bg-brand-blue-soft/70 p-1 sm:inline-flex sm:w-auto sm:max-w-none">
                <Skeleton className="h-8 flex-1 rounded-md bg-brand-blue-soft/90 sm:w-24" />
                <Skeleton className="h-8 flex-1 rounded-md bg-brand-blue-soft/75 sm:w-28" />
                <Skeleton className="h-8 flex-1 rounded-md bg-brand-blue-soft/75 sm:w-28" />
              </div>

              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <KolDashboardChartCardSkeleton titleWidthClass="w-36" />
                  <KolDashboardChartCardSkeleton titleWidthClass="w-40" />
                </div>

                <div className="overflow-hidden rounded-lg border border-primary/20 shadow-sm">
                  <div className="space-y-0 border-b border-primary/10 bg-brand-blue-soft/30 px-4 py-2">
                    <KolDashboardSectionTitleSkeleton widthClass="w-52" />
                  </div>
                  <div className="divide-y divide-primary/10 p-3 pt-3 sm:p-4">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <KolDashboardCampaignRowSkeleton key={j} />
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

function KolManagementDashboardHeaderSkeleton() {
  return (
    <div className="mb-1 flex-shrink-0 px-1 py-3">
      <div className="mb-3">
        <Skeleton className="h-7 w-[min(220px,50vw)] max-w-xs rounded-md" />
        <Skeleton className="mt-0.5 h-3 w-[min(360px,85vw)] max-w-md rounded-md" />
      </div>
      <div className="-mb-3">
        <nav className="flex space-x-6" aria-hidden>
          {[
            "w-[92px]",
            "w-[128px]",
            "w-[96px]",
            "w-[108px]",
            "w-[116px]",
          ].map((widthClass, i) => (
            <div key={i} className="flex items-center space-x-1.5 border-b-2 border-transparent py-1.5">
              <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
              <Skeleton className={cn("h-4 rounded-md", widthClass)} />
            </div>
          ))}
        </nav>
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
              <KolManagementDashboardHeaderSkeleton />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
                <KolManagementDashboardSkeletonMain />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

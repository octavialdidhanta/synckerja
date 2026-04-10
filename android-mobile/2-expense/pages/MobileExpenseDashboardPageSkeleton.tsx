import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

export type MobileExpenseDashboardPageSkeletonProps = {
  className?: string;
};

/**
 * Konten scroll saja: carousel, breakdown, toolbar + tabel.
 * Dipakai di dalam chrome (`MobileExpenseDashboardChromeSkeleton`).
 */
export function MobileExpenseDashboardPageSkeleton({ className }: MobileExpenseDashboardPageSkeletonProps) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      {/* Carousel */}
      <div className="w-full overflow-hidden">
        <div className="min-h-[7.25rem] w-full overflow-hidden rounded-lg border-0 bg-primary">
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg bg-primary-foreground/25" aria-hidden />
              <Skeleton className="h-4 max-w-[180px] flex-1 bg-primary-foreground/25" aria-hidden />
            </div>
            <Skeleton className="h-8 w-3/4 max-w-[140px] bg-primary-foreground/30" aria-hidden />
            <div className="flex items-end justify-between gap-2 pt-0.5">
              <Skeleton className="h-3 w-1/2 max-w-[100px] bg-primary-foreground/20" aria-hidden />
              <Skeleton className="h-8 w-24 rounded-md bg-primary-foreground/90" aria-hidden />
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-1.5 pb-1 pt-3" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-2 rounded-full bg-primary/35", i === 0 ? "w-5" : "w-2")} />
          ))}
        </div>
      </div>

      {/* Expense breakdown */}
      <div className="w-full min-w-0 rounded-lg border border-border bg-card">
        <div className="flex min-w-0 flex-col px-3 pb-2 pt-3">
          <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
            <Skeleton className="h-5 w-36" aria-hidden />
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-3 w-14" aria-hidden />
              <Skeleton className="h-6 w-28" aria-hidden />
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/40 p-0.5">
            <Skeleton className="h-9 rounded-md bg-primary/80" aria-hidden />
            <Skeleton className="h-9 rounded-md" aria-hidden />
            <Skeleton className="h-9 rounded-md" aria-hidden />
          </div>
          <div className="flex h-48 flex-nowrap items-end justify-start gap-3 pb-0 pt-2" aria-hidden>
            {[96, 72, 48, 84, 60].map((heightPx, i) => (
              <div key={i} className="flex min-w-[80px] max-w-[96px] flex-shrink-0 flex-col items-center gap-1">
                <Skeleton className="w-full flex-shrink-0 rounded-t" style={{ height: heightPx }} />
                <Skeleton className="h-3 w-full max-w-[70px]" />
                <Skeleton className="h-3 w-full max-w-[50px]" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table: search + filter + tambah + header biru + baris */}
      <div className="w-full min-w-0 border border-border bg-card">
        <div className="flex min-w-0 flex-col gap-2 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-[7.5rem] shrink-0 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-[4.5rem] shrink-0 rounded-md bg-primary/90" aria-hidden />
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex bg-primary px-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="mr-3 h-3 w-20 bg-primary-foreground/35" aria-hidden />
              ))}
            </div>
            <div className="space-y-2 bg-card p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" aria-hidden />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border px-2 py-3">
            <Skeleton className="h-4 w-28" aria-hidden />
            <Skeleton className="h-4 w-40" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

export type MobileExpenseDashboardChromeSkeletonProps = {
  /** Wrapper tambahan di sekeliling `<main>` (mis. portal root). */
  wrapperClassName?: string;
};

/**
 * Header + area scroll + bottom nav (5 tab), selaras `MobileExpensesShell`.
 */
export function MobileExpenseDashboardChromeSkeleton({ wrapperClassName }: MobileExpenseDashboardChromeSkeletonProps) {
  const { t } = useAppTranslation();
  const aria = t("expenses.dashboard.loadingAria", "Loading expense dashboard");
  const { mainFixedStyle } = useVisualViewport();

  const inner = (
    <>
      <span className="sr-only">{aria}</span>
      <main
        className="fixed inset-x-0 z-0 flex min-h-0 w-full min-w-0 max-w-none flex-col bg-background"
        style={mainFixedStyle}
        aria-busy="true"
        aria-label={aria}
      >
        <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
          <div className="flex min-w-0 items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-24 max-w-full" aria-hidden />
              <Skeleton className="h-3 w-44 max-w-full" aria-hidden />
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="h-0 shrink-0" aria-hidden />
            <MobileExpenseDashboardPageSkeleton className="mx-auto w-full max-w-md content-padding-above-nav-default px-2 pt-2" />
          </div>
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card safe-area-bottom-lower"
        aria-hidden
      >
        <div className="mx-auto grid w-full max-w-md grid-cols-5 px-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-2">
              <Skeleton className={cn("h-5 w-5 rounded-md", i === 0 ? "bg-primary/50" : "")} aria-hidden />
              <Skeleton className={cn("h-2 w-14 max-w-full", i === 0 ? "bg-primary/45" : "")} aria-hidden />
            </div>
          ))}
        </div>
      </nav>
    </>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{inner}</div>;
  }
  return inner;
}

/** Guard + Suspense: root relatif + chrome penuh. */
export function MobileExpenseDashboardShellSkeleton() {
  return (
    <div className="relative min-h-[100dvh] min-w-0 w-full bg-background">
      <MobileExpenseDashboardChromeSkeleton />
    </div>
  );
}

/** Overlay data: tutup seluruh viewport (di atas header & bottom tabs app). */
export function MobileExpenseDashboardFullViewportOverlay() {
  return (
    <MobileExpenseDashboardChromeSkeleton wrapperClassName="fixed inset-0 z-[200] bg-background" />
  );
}

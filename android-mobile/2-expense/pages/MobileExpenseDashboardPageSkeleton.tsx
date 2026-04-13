import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

export type MobileExpenseDashboardPageSkeletonProps = {
  className?: string;
};

const CAROUSEL_BAR_HEIGHTS_PX = [96, 72, 48, 84, 60] as const;
/** Mirror `ExpenseTableSection` mobile thead column count for scroll width rhythm */
const TABLE_HEAD_PLACEHOLDERS = 15;
const TABLE_BODY_ROWS = 10;
const TABLE_SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * Konten scroll: carousel, breakdown, kartu tabel — selaras `MobileDebtPageSkeleton` + `ExpenseTableSection` mobile.
 */
export function MobileExpenseDashboardPageSkeleton({ className }: MobileExpenseDashboardPageSkeletonProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-1", className)}>
      {/* Carousel — satu slide: sama `min-h-[7.25rem]` + `p-3` + `gap-3` seperti kartu carousel */}
      <div className="w-full shrink-0 overflow-hidden">
        <div className="min-h-[7.25rem] w-full min-w-0 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex min-w-0 flex-col gap-3 p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" aria-hidden />
              <Skeleton className="h-4 max-w-[200px] flex-1" aria-hidden />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Skeleton className="h-9 max-w-[240px] sm:max-w-[280px]" aria-hidden />
              <Skeleton className="h-3 max-w-[160px]" aria-hidden />
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-1.5 pb-1 pt-3" aria-hidden>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-2 rounded-full", i === 0 ? "w-5" : "w-2")}
              aria-hidden
            />
          ))}
        </div>
      </div>

      {/* Expense breakdown — `Card` + `px-3 pb-2 pt-3`, `TabsList` `h-10`, chart `h-48 min-h-[12rem]` */}
      <Card className="w-full min-w-0 shrink-0 border border-border bg-card">
        <CardContent className="flex min-w-0 flex-col px-3 pb-2 pt-3">
          <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
            <Skeleton className="h-6 w-40 max-w-[55%] sm:h-7" aria-hidden />
            <div className="flex min-w-0 flex-shrink-0 flex-col items-end gap-1">
              <Skeleton className="h-3 w-16" aria-hidden />
              <Skeleton className="h-6 w-28 sm:h-7" aria-hidden />
            </div>
          </div>
          <div className="mb-4 grid h-10 w-full grid-cols-3 overflow-hidden rounded-md border border-border bg-muted p-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none" aria-hidden />
            ))}
          </div>
          <div className="-mx-1 overflow-x-hidden px-1">
            <div className="flex min-h-0 flex-nowrap items-end justify-start gap-3 pb-0 pt-2">
              {CAROUSEL_BAR_HEIGHTS_PX.map((heightPx, i) => (
                <div
                  key={i}
                  className="flex min-w-[80px] max-w-[96px] flex-shrink-0 flex-col items-center gap-1 pb-0"
                >
                  <div className="flex h-48 min-h-[12rem] w-full flex-col justify-end rounded-md border border-border bg-muted p-1">
                    <Skeleton className="w-full rounded-t" style={{ height: heightPx }} aria-hidden />
                  </div>
                  <Skeleton className="h-3 w-full max-w-[72px]" aria-hidden />
                  <Skeleton className="h-3 w-full max-w-[56px]" aria-hidden />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Card className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden border border-border bg-card">
          <CardContent className="flex min-h-0 min-w-0 flex-col p-0">
            <div className="min-w-0 flex-shrink-0 border-b bg-muted/50 px-1.5 py-1.5">
              <div className="flex min-w-0 flex-nowrap items-center gap-1">
                <Skeleton className="h-9 min-w-[100px] flex-1 rounded-md" aria-hidden />
                <Skeleton className="h-9 w-[7.5rem] shrink-0 rounded-md" aria-hidden />
                <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
                <Skeleton className="h-9 w-[4.5rem] shrink-0 rounded-md" aria-hidden />
              </div>
            </div>
            <div
              className={cn(
                "nested-scroll-touch-chain-xy h-[min(28rem,calc(100dvh-14rem))] max-h-[28rem] min-h-[11rem] shrink-0 touch-pan-x overflow-x-auto overflow-y-auto seamless-scroll",
                TABLE_SCROLL_HIDE,
              )}
            >
              <table className="w-full min-w-[1400px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-border bg-muted">
                  <tr>
                    {Array.from({ length: TABLE_HEAD_PLACEHOLDERS }).map((_, i) => (
                      <th key={i} className="whitespace-nowrap px-2 py-2 text-left">
                        <Skeleton className="h-3 w-14 sm:w-16" aria-hidden />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: TABLE_BODY_ROWS }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={TABLE_HEAD_PLACEHOLDERS} className="px-2 py-2">
                        <Skeleton className="h-8 w-full" aria-hidden />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex min-w-0 flex-shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/50 px-2 py-2">
              <Skeleton className="h-3 w-36 max-w-[45%]" aria-hidden />
              <Skeleton className="h-3 w-32 max-w-[45%]" aria-hidden />
            </div>
          </CardContent>
        </Card>
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
    <main
      className="fixed inset-x-0 z-0 flex flex-col bg-background"
      style={mainFixedStyle}
      aria-busy="true"
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <header className="safe-area-top sticky top-0 z-30 flex flex-shrink-0 items-center justify-between border-b border-border bg-card p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-24 max-w-full" aria-hidden />
            <Skeleton className="h-3 w-44 max-w-full" aria-hidden />
          </div>
        </div>
        <div />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="h-0 shrink-0" aria-hidden />
          <div className="flex min-h-full min-w-0 flex-1 flex-col">
            <MobileExpenseDashboardPageSkeleton className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col content-padding-above-nav-default px-2 pt-2" />
          </div>
        </div>
      </div>

      <nav
        className="mobile-app-bottom-nav fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card"
        aria-hidden
      >
        <div className="safe-area-bottom-lower mx-auto grid min-h-[52px] w-full max-w-md grid-cols-5 px-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-1 py-2">
              <Skeleton className="mb-0 h-5 w-5 rounded-md" aria-hidden />
              <Skeleton className="h-2.5 w-14 max-w-full rounded-sm" aria-hidden />
            </div>
          ))}
        </div>
      </nav>
    </main>
  );

  if (wrapperClassName) {
    return <div className={wrapperClassName}>{inner}</div>;
  }
  return inner;
}

/** Guard + Suspense: root relatif + chrome penuh. */
export function MobileExpenseDashboardShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background">
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

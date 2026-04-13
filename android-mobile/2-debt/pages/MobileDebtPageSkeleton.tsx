import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

/** Selaras `DebtDashboardCarousel` (`LOGICAL_SLIDE_COUNT = 4`). */
const CAROUSEL_DOT_COUNT = 4;
/** Selaras `DebtTableSection` thead + baris loading (viewport ~10 baris). */
const DEBT_TABLE_COLUMNS = 13;
const DEBT_TABLE_BODY_ROWS = 10;

const TABLE_SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Satu sumber skeleton carousel — dipakai route shell + `DebtDashboardCarousel` saat loading. */
export function MobileDebtCarouselSkeleton() {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="w-full">
        <div className="min-h-[7.25rem] w-full overflow-hidden rounded-lg border border-border bg-card">
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" aria-hidden />
              <Skeleton className="h-4 max-w-[180px] flex-1" aria-hidden />
            </div>
            <Skeleton className="h-8 w-3/4 max-w-[140px]" aria-hidden />
            <Skeleton className="h-3 w-1/2 max-w-[100px]" aria-hidden />
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 pb-1 pt-1" aria-hidden>
        {Array.from({ length: CAROUSEL_DOT_COUNT }).map((_, i) => (
          <Skeleton key={i} className={cn("h-2 rounded-full", i === 0 ? "w-5" : "w-2")} aria-hidden />
        ))}
      </div>
    </div>
  );
}

/** Baris tbody tabel — dipakai `DebtTableSection` saat loading (toolbar/header tetap asli). */
export function MobileDebtTableBodyRows() {
  return (
    <>
      {Array.from({ length: DEBT_TABLE_BODY_ROWS }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border">
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-full max-w-[120px]" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-20" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-20" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-16" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-16" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-16" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-16" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-16" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-20" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-16" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-4 w-16" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-5 w-16 rounded-full" aria-hidden />
          </td>
          <td className="px-2 py-2">
            <Skeleton className="h-8 w-8 rounded" aria-hidden />
          </td>
        </tr>
      ))}
    </>
  );
}

function MobileDebtTableCardSkeleton() {
  return (
    <Card className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden border border-border bg-card">
      <CardContent className="flex min-h-0 min-w-0 flex-col p-0">
        <div className="min-w-0 flex-shrink-0 border-b bg-muted/50 px-1.5 py-1.5">
          <div className="flex w-full min-w-0 items-center gap-1">
            <Skeleton className="h-9 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-9 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-9 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
          </div>
        </div>

        <div
          className={cn(
            "nested-scroll-touch-chain-xy h-[min(28rem,calc(100dvh-14rem))] max-h-[28rem] min-h-[11rem] shrink-0 touch-pan-x overflow-x-auto overflow-y-auto seamless-scroll",
            TABLE_SCROLL_HIDE,
          )}
        >
          <table className="min-w-[1600px] w-full border-collapse">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted">
              <tr>
                {Array.from({ length: DEBT_TABLE_COLUMNS }).map((_, i) => (
                  <th key={i} className="whitespace-nowrap px-2 py-2 text-left">
                    <Skeleton className="h-3 w-14 sm:w-16" aria-hidden />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MobileDebtTableBodyRows />
            </tbody>
          </table>
        </div>

        <div className="flex min-w-0 flex-shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/50 px-2 py-2">
          <Skeleton className="h-3 w-36 max-w-[45%]" aria-hidden />
          <Skeleton className="h-3 w-32 max-w-[45%]" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}

export type MobileDebtPageSkeletonProps = {
  className?: string;
};

/**
 * Konten scroll penuh untuk guard/Suspense: carousel + kartu tabel (placeholder netral).
 */
export function MobileDebtPageSkeleton({ className }: MobileDebtPageSkeletonProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-1", className)}>
      <div className="shrink-0">
        <MobileDebtCarouselSkeleton />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileDebtTableCardSkeleton />
      </div>
    </div>
  );
}

export type MobileDebtChromeSkeletonProps = {
  wrapperClassName?: string;
};

/**
 * Header + scroll + bottom nav (5 tab), selaras `MobileExpensesShell` pada tab debt.
 */
export function MobileDebtChromeSkeleton({ wrapperClassName }: MobileDebtChromeSkeletonProps) {
  const { t } = useAppTranslation();
  const aria = t("debt.route.loadingAria", "Loading debt");
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
          <div className="flex min-h-full min-w-0 flex-1 flex-col">
            <div className="h-0 shrink-0" aria-hidden />
            <MobileDebtPageSkeleton className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col content-padding-above-nav-default px-2 pt-2" />
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
export function MobileDebtShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <MobileDebtChromeSkeleton />
    </div>
  );
}

/** Overlay data: menutupi seluruh viewport (header shell + konten + bottom tabs) sampai data siap. */
export function MobileDebtFullViewportOverlay() {
  return (
    <MobileDebtChromeSkeleton wrapperClassName="fixed inset-0 z-[200] min-h-[100dvh] bg-background" />
  );
}

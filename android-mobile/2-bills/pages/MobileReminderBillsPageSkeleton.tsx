import { Skeleton } from "@/mobile-app/components/ui/skeleton";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { cn } from "@/shared/lib/utils";

const CAROUSEL_DOT_COUNT = 4;
const BILLS_TABLE_COLUMNS = 8;
const BILLS_TABLE_BODY_ROWS = 10;

const MOBILE_BILLS_TABLE_VIEWPORT_CLASS =
  "h-[min(28rem,calc(100dvh-14rem))] max-h-[28rem] min-h-[11rem] shrink-0";

const TABLE_SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function MobileReminderBillsCarouselSkeleton() {
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

export function MobileReminderBillsTableBodyRows() {
  return (
    <>
      {Array.from({ length: BILLS_TABLE_BODY_ROWS }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-border">
          {Array.from({ length: BILLS_TABLE_COLUMNS }).map((__, ci) => (
            <td key={ci} className="px-2 py-2">
              <Skeleton className="h-4 w-full max-w-[100px]" aria-hidden />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MobileReminderBillsTableCardSkeleton() {
  return (
    <Card className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden border border-border bg-card">
      <CardContent className="flex min-h-0 min-w-0 flex-col p-0">
        <div className="min-w-0 flex-shrink-0 border-b bg-muted/50 px-1.5 py-1.5">
          <div className="flex w-full min-w-0 items-center gap-1">
            <Skeleton className="h-9 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-9 max-w-[42%] min-w-0 shrink-0 rounded-md sm:max-w-none" aria-hidden />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
          </div>
        </div>

        <div
          className={cn(
            "nested-scroll-touch-chain-xy min-h-0 min-w-0 touch-pan-x overflow-x-auto overflow-y-auto seamless-scroll",
            TABLE_SCROLL_HIDE,
            MOBILE_BILLS_TABLE_VIEWPORT_CLASS,
          )}
        >
          <table className="min-w-[1200px] w-full border-collapse text-sm caption-bottom">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted">
              <tr>
                {Array.from({ length: BILLS_TABLE_COLUMNS }).map((_, i) => (
                  <th key={i} className="h-8 whitespace-nowrap px-2 py-2 text-left">
                    <Skeleton className="h-3 w-14 sm:w-16" aria-hidden />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <MobileReminderBillsTableBodyRows />
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

export type MobileReminderBillsPageSkeletonProps = {
  className?: string;
};

export function MobileReminderBillsPageSkeleton({ className }: MobileReminderBillsPageSkeletonProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-1", className)}>
      <div className="shrink-0">
        <MobileReminderBillsCarouselSkeleton />
      </div>
      <div className="flex min-h-0 min-w-0 shrink-0 flex-col">
        <MobileReminderBillsTableCardSkeleton />
      </div>
    </div>
  );
}

export type MobileReminderBillsChromeSkeletonProps = {
  wrapperClassName?: string;
};

export function MobileReminderBillsChromeSkeleton({ wrapperClassName }: MobileReminderBillsChromeSkeletonProps) {
  const { t } = useAppTranslation();
  const aria = t("reminderBills.route.loadingAria", "Loading reminder bills");
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
            <MobileReminderBillsPageSkeleton className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col content-padding-above-nav-default px-2 pt-2" />
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

export function MobileReminderBillsShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <MobileReminderBillsChromeSkeleton />
    </div>
  );
}

export function MobileReminderBillsFullViewportOverlay() {
  return (
    <MobileReminderBillsChromeSkeleton wrapperClassName="fixed inset-0 z-[200] min-h-[100dvh] bg-background" />
  );
}

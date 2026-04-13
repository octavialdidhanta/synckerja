import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { MobileIncomesViewportChromeSkeleton } from "@/mobile/3-dashboard/pages/MobileIncomesViewportChromeSkeleton";
import { MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS } from "@/mobile/shared/mobileWideFinanceTableViewport";

/** Matches `MobileIncomeTransactionDashboardCarousel` (`LOGICAL_SLIDE_COUNT = 4`). */
const TRANSACTION_CAROUSEL_DOT_COUNT = 4;

/** Shared carousel placeholder — overlay + `MobileIncomeTransactionDashboardCarousel` when `isLoading`. */
export function MobileIncomeTransactionCarouselSkeleton() {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="w-full px-0" style={{ width: "100%" }}>
        <div className="min-h-[7.25rem] w-full overflow-hidden rounded-lg border border-border bg-card">
          <div className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" aria-hidden />
              <Skeleton className="h-4 max-w-[180px] flex-1" aria-hidden />
            </div>
            <Skeleton className="h-8 w-3/4 max-w-[140px]" aria-hidden />
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-1.5 pb-1 pt-3" aria-hidden>
        {Array.from({ length: TRANSACTION_CAROUSEL_DOT_COUNT }).map((_, i) => (
          <Skeleton key={i} className={cn("h-2 rounded-full", i === 0 ? "w-5" : "w-2")} aria-hidden />
        ))}
      </div>
    </div>
  );
}

function MobileIncomeTransactionTableCardSkeleton() {
  return (
    <Card className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden border border-border bg-card">
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col p-0">
        <div className="min-w-0 flex-shrink-0 border-b border-border bg-muted/50 px-1.5 py-1.5">
          <div className="flex min-w-0 flex-nowrap items-center gap-1">
            <Skeleton className="h-9 min-w-[100px] flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
            <Skeleton className="h-9 min-w-[88px] shrink-0 rounded-md" aria-hidden />
            <Skeleton className="h-9 min-w-[72px] shrink-0 rounded-md" aria-hidden />
          </div>
        </div>
        <div
          className={cn(
            "flex flex-col gap-2 overflow-hidden p-4",
            MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS,
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full shrink-0 rounded-md" aria-hidden />
          ))}
        </div>
        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-2 py-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-40 max-w-[55%]" aria-hidden />
            <Skeleton className="h-3 w-28 max-w-[40%]" aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export type MobileIncomeTransactionBodySkeletonProps = {
  className?: string;
};

export function MobileIncomeTransactionBodySkeleton({ className }: MobileIncomeTransactionBodySkeletonProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-1", className)}>
      <div className="shrink-0">
        <MobileIncomeTransactionCarouselSkeleton />
      </div>
      <MobileIncomeTransactionTableCardSkeleton />
    </div>
  );
}

export function MobileIncomeTransactionChromeSkeleton({ wrapperClassName }: { wrapperClassName?: string }) {
  const { t } = useAppTranslation();
  const aria = t("incomes.incomeTransactionList.loadingAria", "Loading income transactions");
  return (
    <MobileIncomesViewportChromeSkeleton wrapperClassName={wrapperClassName} ariaLabel={aria}>
      <MobileIncomeTransactionBodySkeleton className="mx-auto flex min-h-0 min-w-0 w-full max-w-md flex-1 flex-col content-padding-above-nav-default px-2 pt-2" />
    </MobileIncomesViewportChromeSkeleton>
  );
}

export function MobileIncomeTransactionFullViewportOverlay() {
  return (
    <MobileIncomeTransactionChromeSkeleton wrapperClassName="fixed inset-0 z-[200] min-h-[100dvh] bg-background" />
  );
}

export function MobileIncomeTransactionShellSkeleton() {
  return (
    <div className="relative min-h-[100dvh] min-w-0 w-full bg-background">
      <MobileIncomeTransactionChromeSkeleton />
    </div>
  );
}

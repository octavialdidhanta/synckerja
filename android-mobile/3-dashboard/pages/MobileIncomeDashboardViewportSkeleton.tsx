import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { MobileIncomesViewportChromeSkeleton } from "@/mobile/3-dashboard/pages/MobileIncomesViewportChromeSkeleton";

/** Matches `MobileIncomeDashboardCarousel` (`LOGICAL_SLIDE_COUNT = 5`). */
const INCOME_CAROUSEL_DOT_COUNT = 5;

/** Shared carousel placeholder — route shell, overlay chrome, and `MobileIncomeDashboardCarousel` when `isLoading`. */
export function MobileIncomeCarouselSkeleton() {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="px-0" style={{ width: "100%" }}>
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
      <div className="flex justify-center gap-1.5 pb-1 pt-3" aria-hidden>
        {Array.from({ length: INCOME_CAROUSEL_DOT_COUNT }).map((_, i) => (
          <Skeleton key={i} className={cn("h-2 rounded-full", i === 0 ? "w-5" : "w-2")} aria-hidden />
        ))}
      </div>
    </div>
  );
}

function MobileIncomeDistributionCardSkeleton() {
  return (
    <Card className="min-w-0 overflow-hidden border border-border bg-card">
      <CardContent className="flex min-w-0 flex-col p-0">
        <div className="grid min-w-0 grid-cols-3 gap-2 border-b border-border bg-muted/50 px-2 py-2">
          <Skeleton className="h-9 w-full rounded-md" aria-hidden />
          <Skeleton className="h-9 w-full rounded-md" aria-hidden />
          <Skeleton className="h-9 w-full rounded-md" aria-hidden />
        </div>
        <div className="flex gap-1 border-b border-border px-2 py-2">
          <Skeleton className="h-8 min-w-0 flex-1 rounded-md" aria-hidden />
          <Skeleton className="h-8 min-w-0 flex-1 rounded-md" aria-hidden />
          <Skeleton className="h-8 min-w-0 flex-1 rounded-md" aria-hidden />
        </div>
        <div className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" aria-hidden />
            <Skeleton className="h-8 w-8 rounded-md" aria-hidden />
          </div>
          <Skeleton className="h-[200px] w-full rounded-md" aria-hidden />
        </div>
      </CardContent>
    </Card>
  );
}

function MobileNetIncomePerBankCardSkeleton() {
  return (
    <Card className="min-w-0 overflow-hidden border border-border bg-card">
      <CardHeader className="px-3 pb-2 pt-3">
        <Skeleton className="h-5 w-48 max-w-full" aria-hidden />
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        <Skeleton className="h-16 w-full rounded-md" aria-hidden />
        <Skeleton className="h-16 w-full rounded-md" aria-hidden />
      </CardContent>
    </Card>
  );
}

export type MobileIncomeDashboardBodySkeletonProps = {
  className?: string;
};

/** Scroll body: carousel + distribution + net per bank — matches live tab stack (`gap-1` / `space-y-1`). */
export function MobileIncomeDashboardBodySkeleton({ className }: MobileIncomeDashboardBodySkeletonProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <MobileIncomeCarouselSkeleton />
      <MobileIncomeDistributionCardSkeleton />
      <MobileNetIncomePerBankCardSkeleton />
    </div>
  );
}

export type MobileIncomeDashboardChromeSkeletonProps = {
  wrapperClassName?: string;
};

/**
 * Header + scroll + bottom nav (3 tabs), aligned with `MobileIncomesShell` chrome (no sidebar in overlay).
 */
export function MobileIncomeDashboardChromeSkeleton({ wrapperClassName }: MobileIncomeDashboardChromeSkeletonProps) {
  const { t } = useAppTranslation();
  const aria = t("incomes.dashboard.loadingAria", "Loading income dashboard");
  return (
    <MobileIncomesViewportChromeSkeleton wrapperClassName={wrapperClassName} ariaLabel={aria}>
      <MobileIncomeDashboardBodySkeleton className="mx-auto w-full max-w-md content-padding-above-nav-default px-2 pt-2" />
    </MobileIncomesViewportChromeSkeleton>
  );
}

/** Data overlay: full viewport above shell until initial load settles. */
export function MobileIncomeDashboardFullViewportOverlay() {
  return (
    <MobileIncomeDashboardChromeSkeleton wrapperClassName="fixed inset-0 z-[200] bg-background" />
  );
}

/** Guard + Suspense: satu chrome penuh (tanpa sidebar), sama ritme `MobileExpenseDashboardShellSkeleton`. */
export function MobileIncomeDashboardShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <MobileIncomeDashboardChromeSkeleton />
    </div>
  );
}

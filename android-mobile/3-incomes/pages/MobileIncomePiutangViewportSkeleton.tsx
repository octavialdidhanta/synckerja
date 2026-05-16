import { Skeleton } from '@/shared/components/ui/skeleton';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { MobileIncomesViewportChromeSkeleton } from '@/mobile/3-dashboard/pages/MobileIncomesViewportChromeSkeleton';
import { MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS } from '@/mobile/shared/mobileWideFinanceTableViewport';
import { MobilePiutangCarouselSkeleton } from '@/mobile/3-incomes/section/MobilePiutangMetricsCarousel';

function MobileIncomePiutangTableCardSkeleton() {
  return (
    <Card className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden border border-border bg-card">
      <CardContent className="flex min-h-0 min-w-0 flex-col p-0">
        <div className="min-w-0 flex-shrink-0 border-b border-border bg-muted/50 px-1.5 py-1.5">
          <div className="flex min-w-0 w-full flex-nowrap items-center gap-1">
            <Skeleton className="h-9 min-w-0 flex-1 rounded-md" aria-hidden />
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" aria-hidden />
            <Skeleton className="h-9 min-w-[88px] shrink-0 rounded-md" aria-hidden />
          </div>
        </div>
        <div className={cn('min-h-0 min-w-0 shrink-0', MOBILE_WIDE_FINANCE_TABLE_VIEWPORT_CLASS)}>
          <div className="flex flex-col gap-0">
            <Skeleton className="h-9 w-full shrink-0 rounded-none bg-slate-500/80" aria-hidden />
            <div className="flex flex-col gap-0 p-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-12 w-full shrink-0 rounded-none border-b border-border/60"
                  aria-hidden
                />
              ))}
            </div>
          </div>
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

export type MobileIncomePiutangBodySkeletonProps = {
  className?: string;
};

/** Mirror `MobileIncomePiutangSection` (carousel + card filter/tabel/footer). */
export function MobileIncomePiutangBodySkeleton({ className }: MobileIncomePiutangBodySkeletonProps) {
  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-1 flex-col gap-1', className)}>
      <div className="shrink-0">
        <MobilePiutangCarouselSkeleton />
      </div>
      <MobileIncomePiutangTableCardSkeleton />
    </div>
  );
}

export function MobileIncomePiutangChromeSkeleton({ wrapperClassName }: { wrapperClassName?: string }) {
  const { t } = useAppTranslation();
  const aria = t('incomes.piutang.loadingAria', 'Memuat piutang');

  return (
    <MobileIncomesViewportChromeSkeleton wrapperClassName={wrapperClassName} ariaLabel={aria}>
      <MobileIncomePiutangBodySkeleton className="mx-auto flex min-h-0 min-w-0 w-full max-w-md flex-1 flex-col content-padding-above-nav-default px-2 pt-2" />
    </MobileIncomesViewportChromeSkeleton>
  );
}

/** Guard / Suspense / hard refresh — satu skeleton mobile piutang. */
export function MobileIncomePiutangShellSkeleton() {
  return (
    <div className="relative min-h-[100dvh] min-w-0 w-full bg-background">
      <MobileIncomePiutangChromeSkeleton />
    </div>
  );
}

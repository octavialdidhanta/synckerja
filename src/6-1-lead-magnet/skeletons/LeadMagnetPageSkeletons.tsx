import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { LeadMagnetPageSkeletonFrame } from '../layout/LeadMagnetPageSkeletonFrame';
import { LeadMagnetHeaderAndTab } from '../container/LeadMagnetHeaderAndTab';

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export function LeadMagnetListPageSkeleton({ includeHeader = true }: { includeHeader?: boolean }) {
  const { t } = useAppTranslation();
  const aria = t('leadMagnet.list.loadingAria', 'Loading lead magnet');

  return (
    <LeadMagnetPageSkeletonFrame
      includeHeader={includeHeader}
      ariaLabel={aria}
      toolbar={
        <>
          <Skeleton className="h-10 w-full shrink-0 rounded-md" />
          <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
          <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        </>
      }
    >
      <div className="min-h-0 min-w-0 flex-1 space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </LeadMagnetPageSkeletonFrame>
  );
}

export function LeadMagnetWizardPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('leadMagnet.wizard.loadingAria', 'Loading campaign wizard');

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className={MAIN_SCROLL}>
            <div className="flex min-h-full flex-col bg-muted/40">
              <div className="mb-1 flex-shrink-0">
                <LeadMagnetHeaderAndTab />
              </div>
              <div className="mx-auto w-full max-w-3xl space-y-4 py-1">
                <Skeleton className="h-9 w-full max-w-lg" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeadMagnetAnalyticsPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('leadMagnet.analytics.loadingAria', 'Loading campaign analytics');

  return (
    <LeadMagnetPageSkeletonFrame
      ariaLabel={aria}
      toolbar={
        <div className="flex shrink-0 items-center justify-between gap-2">
          <Skeleton className="h-8 w-40" />
          <div className="space-y-1.5">
            <Skeleton className="ml-auto h-4 w-40" />
            <Skeleton className="ml-auto h-3 w-32" />
          </div>
        </div>
      }
      sidebar={
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
          <Skeleton className="mb-3 h-4 w-36" />
          <div className="min-h-0 flex-1 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </div>
        </div>
      }
    >
      <div className="flex-shrink-0 px-4 pt-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </LeadMagnetPageSkeletonFrame>
  );
}

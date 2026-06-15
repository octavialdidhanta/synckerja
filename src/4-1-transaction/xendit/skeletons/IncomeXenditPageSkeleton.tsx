import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  XENDIT_MAIN_GRID,
  XENDIT_TABLE_SECTION,
} from '@/4-1-transaction/xendit/layout/xenditPageLayout';

type IncomeXenditPageSkeletonProps = {
  variant?: 'connect' | 'balance' | 'history';
};

function XenditHeaderSkeleton() {
  return (
    <div className="mb-1 shrink-0 px-1 py-3">
      <div className="mb-3 space-y-1.5">
        <Skeleton className="h-7 w-40 max-w-[90vw]" />
        <Skeleton className="h-3 w-full max-w-lg" />
      </div>
      <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-40" />
      </div>
    </div>
  );
}

function XenditCardSkeleton({ variant }: { variant: 'connect' | 'balance' | 'history' }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="shrink-0 border-b border-border p-4 [@media(max-height:900px)]:p-3">
        <Skeleton className="mb-2 h-5 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-6 [@media(max-height:900px)]:p-4">
        {variant === 'connect' ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : variant === 'balance' ? (
          <div className="mx-auto max-w-2xl space-y-5">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <div className="flex justify-end">
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        ) : (
          <Skeleton className="h-full min-h-[200px] w-full rounded-lg" />
        )}
      </div>
      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export function IncomeXenditPageSkeleton({ variant = 'connect' }: IncomeXenditPageSkeletonProps) {
  const { t } = useAppTranslation();
  const aria = t('xendit.loadingAria', 'Loading Xendit settings');
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label={aria}
    >
      <span className="sr-only">{aria}</span>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col">
              <XenditHeaderSkeleton />
              <div className={XENDIT_MAIN_GRID}>
                <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                  <div className={XENDIT_TABLE_SECTION}>
                    <XenditCardSkeleton variant={variant} />
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

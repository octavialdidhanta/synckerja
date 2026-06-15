import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Skeleton } from '@/shared/components/ui/skeleton';

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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <XenditHeaderSkeleton />
          <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
            <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              {variant === 'connect' ? (
                <div className="space-y-4 p-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : variant === 'balance' ? (
                <>
                  <div className="shrink-0 border-b border-gray-200 p-4">
                    <Skeleton className="mb-2 h-5 w-48" />
                    <Skeleton className="h-4 w-72" />
                  </div>
                  <div className="space-y-5 p-6">
                    <Skeleton className="h-28 w-full rounded-lg" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                    <div className="flex justify-end">
                      <Skeleton className="h-9 w-28" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="shrink-0 border-b border-gray-200 p-4">
                    <Skeleton className="mb-2 h-5 w-44" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <div className="space-y-2 p-6">
                    <Skeleton className="h-40 w-full rounded-lg" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

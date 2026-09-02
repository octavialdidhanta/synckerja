import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { XenditBalancePageSkeletonFrame } from '@/4-1-transaction/xendit/layout/XenditBalancePageSkeletonFrame';

function XenditBalanceSkeletonBody() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-2 h-9 w-44" />
        <Skeleton className="mt-2 h-3 w-48" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-3 w-full max-w-xs" />
      </div>
    </div>
  );
}

/** Tab body only — mirrors `XenditBalancePage` di dalam `IncomeXenditModuleShell`. */
export function XenditBalanceTabSkeleton() {
  return (
    <XenditBalancePageSkeletonFrame includeHeader={false}>
      <XenditBalanceSkeletonBody />
    </XenditBalancePageSkeletonFrame>
  );
}

/** Skeleton khusus `/xendit/balance` — shell + HeaderAndTab + kartu saldo. */
export function XenditBalancePageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('xendit.balance.loadingAria', 'Loading Xendit balance');

  return (
    <XenditBalancePageSkeletonFrame ariaLabel={aria}>
      <XenditBalanceSkeletonBody />
    </XenditBalancePageSkeletonFrame>
  );
}

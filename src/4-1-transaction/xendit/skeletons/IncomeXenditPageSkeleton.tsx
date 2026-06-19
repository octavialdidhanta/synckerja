import type { ReactNode } from 'react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import {
  XENDIT_MAIN_GRID,
  XENDIT_MAIN_INNER_SCROLL,
  XENDIT_TABLE_SECTION,
} from '@/4-1-transaction/xendit/layout/xenditPageLayout';

type IncomeXenditPageSkeletonProps = {
  variant?: 'connect' | 'balance' | 'history';
};

const MAIN_SCROLL =
  'scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function XenditHeaderSkeleton() {
  return (
    <div className="px-1 py-3">
      <div className="mb-3">
        <Skeleton className="mb-1.5 h-7 w-28" />
        <Skeleton className="h-3 w-full max-w-xl" />
      </div>
      <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}

function XenditTabCardShell({
  header,
  footer,
  bodyClassName,
  fillBody = false,
  children,
}: {
  header: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  fillBody?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={XENDIT_MAIN_GRID}>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
        <div className={XENDIT_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-shrink-0 border-b border-border">{header}</div>
            <div
              className={cn(
                fillBody
                  ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                  : XENDIT_MAIN_INNER_SCROLL,
                bodyClassName,
              )}
            >
              {children}
            </div>
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

function XenditPanelFooterSkeleton() {
  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/** Tab body only — mirrors `XenditConnectPageWrapper` + settings panel. */
export function XenditConnectTabSkeleton() {
  return (
    <XenditTabCardShell
      header={
        <div className="space-y-1 p-4 [@media(max-height:900px)]:p-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      }
      footer={<XenditPanelFooterSkeleton />}
      bodyClassName="p-4 [@media(max-height:900px)]:p-3"
    >
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
        <Skeleton className="h-3 w-full max-w-sm" />
      </div>
    </XenditTabCardShell>
  );
}

/** Tab body only — mirrors `XenditBalancePage` saldo & penarikan layout. */
export function XenditBalanceTabSkeleton() {
  return (
    <XenditTabCardShell
      header={
        <div className="flex items-center justify-between gap-3 p-4 [@media(max-height:900px)]:p-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
        </div>
      }
      bodyClassName="p-4 [@media(max-height:900px)]:p-3"
    >
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
    </XenditTabCardShell>
  );
}

/** Tab content skeleton — mirrors `/xendit/history` card + table area. */
export function XenditHistoryTabContentSkeleton() {
  return (
    <XenditTabCardShell
      fillBody
      header={
        <div className="space-y-3 p-4 [@media(max-height:900px)]:p-3">
          <div className="space-y-1">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
          <Skeleton className="h-9 w-full max-w-xs" />
        </div>
      }
      footer={<XenditPanelFooterSkeleton />}
    >
      <div className="flex min-h-[200px] flex-1 flex-col p-4 [@media(max-height:900px)]:p-3">
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </XenditTabCardShell>
  );
}

function XenditTabSkeleton({ variant }: { variant: 'connect' | 'balance' | 'history' }) {
  if (variant === 'balance') return <XenditBalanceTabSkeleton />;
  if (variant === 'history') return <XenditHistoryTabContentSkeleton />;
  return <XenditConnectTabSkeleton />;
}

/** Full module shell — guard, Suspense, org bootstrap overlay. */
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
      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className={cn(MAIN_SCROLL, 'min-w-0')}>
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 flex-shrink-0">
                <XenditHeaderSkeleton />
              </div>
              <XenditTabSkeleton variant={variant} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

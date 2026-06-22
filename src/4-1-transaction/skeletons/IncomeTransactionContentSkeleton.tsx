import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  INCOME_TX_MAIN_COLUMN,
  INCOME_TX_MAIN_GRID,
  INCOME_TX_SIDEBAR_COLUMN,
  INCOME_TX_TABLE_SECTION,
} from '@/4-1-transaction/layout/incomeTransactionLayout';

/** Grid konten — mirror `IncomeTransactionPage` (tanpa HeaderAndTab; dipakai overlay data). */
export function IncomeTransactionContentSkeleton() {
  return (
    <div className={INCOME_TX_MAIN_GRID} aria-hidden>
      <div className={`${INCOME_TX_MAIN_COLUMN} flex flex-col gap-2`}>
        <div className="rounded-md border border-border bg-card p-2">
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-9 min-w-[150px] flex-1" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-md border border-brand-blue/30 bg-brand-blue/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <Skeleton className="h-8 w-20" />
              <Skeleton className="mt-1 h-3 w-28" />
            </div>
          ))}
        </div>

        <div className={INCOME_TX_TABLE_SECTION}>
          <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="scrollbar-hide seamless-scroll min-h-0 min-w-0 flex-1 overflow-y-auto p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="min-w-[640px] space-y-2">
                <Skeleton className="h-8 w-full" />
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </div>
      </div>

      <div className={INCOME_TX_SIDEBAR_COLUMN}>
        <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
            <Skeleton className="mb-1 h-4 w-36" />
            <Skeleton className="mt-1 h-3 w-52" />
          </div>
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Skeleton className="mb-4 h-9 w-full max-w-[240px]" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
          <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
            <Skeleton className="h-3 w-full max-w-[200px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

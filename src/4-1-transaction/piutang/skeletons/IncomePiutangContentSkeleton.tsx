import { Skeleton } from '@/shared/components/ui/skeleton';
import { INCOME_TX_MAIN_GRID } from '@/4-1-transaction/layout/incomeTransactionLayout';

/** Grid konten — mirror `IncomePiutangPage` (tanpa HeaderAndTab). */
export function IncomePiutangContentSkeleton() {
  return (
    <div className={INCOME_TX_MAIN_GRID} aria-hidden>
      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="mb-2 flex-shrink-0">
            <div className="rounded-md border border-border bg-card p-2">
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-9 min-w-[150px] flex-1" />
                <Skeleton className="h-9 w-36" />
                <Skeleton className="h-9 w-44" />
              </div>
            </div>
          </div>

          <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
            <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
              <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-2">
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="scrollbar-hide min-w-0 flex-1 overflow-x-auto p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="min-w-[640px] space-y-2">
                  <Skeleton className="h-8 w-full" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-1">
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
              <Skeleton className="mb-1 h-4 w-36" />
              <Skeleton className="mt-1 h-3 w-48" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-4">
              <div className="space-y-3">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-20 w-full rounded-lg" />
              </div>
            </div>
            <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
              <Skeleton className="h-4 w-full max-w-[200px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

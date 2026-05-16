import { Skeleton } from '@/shared/components/ui/skeleton';

/** Mirror `HeaderAndTab` — title, subtitle, 3 tab pills. */
export function IncomeTransactionHeaderSkeleton() {
  return (
    <div className="mb-1 shrink-0 px-1 py-3">
      <div className="mb-3 space-y-1.5">
        <Skeleton className="h-7 w-56 max-w-[90vw]" />
        <Skeleton className="h-3 w-full max-w-xl" />
      </div>
      <div className="-mb-3 flex flex-wrap gap-x-6 gap-y-1">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

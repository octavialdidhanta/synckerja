import { Skeleton } from '@/shared/components/ui/skeleton';

/** Placeholder kolom kanan saat sidebar di-defer. */
export function IncomeTransactionSidebarSkeleton() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm" aria-hidden>
      <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
        <Skeleton className="mb-1 h-4 w-36" />
        <Skeleton className="mt-1 h-3 w-52" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <Skeleton className="mb-4 h-9 w-full max-w-[240px]" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
        <Skeleton className="h-4 w-full max-w-[200px]" />
      </div>
    </div>
  );
}

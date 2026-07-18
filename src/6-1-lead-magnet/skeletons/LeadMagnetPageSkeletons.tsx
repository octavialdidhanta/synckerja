import { Skeleton } from '@/shared/components/ui/skeleton';
import { LEAD_MAGNET_MAIN_GRID, LEAD_MAGNET_TABLE_SECTION } from '../lib/leadMagnetLayout';

function HeaderSkeleton() {
  return (
    <div className="mb-1 shrink-0 px-1 py-3">
      <div className="mb-3 min-w-0 space-y-1.5">
        <Skeleton className="h-7 w-48 max-w-[90vw]" />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      <div className="-mb-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1">
        <Skeleton className="h-9 w-28 shrink-0" />
      </div>
    </div>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/40">
          <HeaderSkeleton />
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LeadMagnetListPageSkeleton() {
  return (
    <ShellFrame>
      <div className={LEAD_MAGNET_MAIN_GRID}>
        <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-10 w-full shrink-0 rounded-md" />
          <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-3">
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
            <Skeleton className="h-16 rounded-md" />
          </div>
          <div className={LEAD_MAGNET_TABLE_SECTION}>
            <Skeleton className="min-h-0 h-full w-full flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </ShellFrame>
  );
}

export function LeadMagnetWizardPageSkeleton() {
  return (
    <ShellFrame>
      <div className="mx-auto max-w-3xl space-y-4 overflow-y-auto py-1">
        <Skeleton className="h-9 w-full max-w-lg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </ShellFrame>
  );
}

export function LeadMagnetAnalyticsPageSkeleton() {
  return (
    <ShellFrame>
      <div className={LEAD_MAGNET_MAIN_GRID}>
        <div className="col-span-12 grid min-h-0 flex-1 gap-2 overflow-hidden lg:grid-cols-12">
          <Skeleton className="min-h-0 h-full rounded-lg lg:col-span-5" />
          <Skeleton className="min-h-0 h-full rounded-lg lg:col-span-7" />
        </div>
      </div>
    </ShellFrame>
  );
}

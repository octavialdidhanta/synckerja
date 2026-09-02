import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { ReminderBillsPageSkeletonFrame } from '@/4-2-reminder-bills/layout/ReminderBillsPageSkeletonFrame';

/** Skeleton khusus `/expenses/reminder-bills` — selaras `ReminderBillsPage`. */
export function ReminderBillsPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('expenses.reminderBills.loadingAria', 'Loading reminder bills');

  return (
    <ReminderBillsPageSkeletonFrame
      ariaLabel={aria}
      toolbar={
        <>
          <div className="shrink-0 rounded-md border border-border bg-card p-2">
            <div className="flex min-w-0 flex-wrap gap-2">
              <Skeleton className="h-9 min-w-[150px] flex-1 sm:max-w-xs" />
              <Skeleton className="h-9 w-36 sm:w-40" />
              <Skeleton className="h-9 w-36 sm:w-40" />
              <Skeleton className="h-9 w-36 sm:w-40" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-md border border-border bg-card p-3 shadow-sm">
                <Skeleton className="mb-2 h-3 w-28" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
            ))}
          </div>
        </>
      }
    >
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </ReminderBillsPageSkeletonFrame>
  );
}

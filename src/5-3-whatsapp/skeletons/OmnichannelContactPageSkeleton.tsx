import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { OmnichannelContactPageSkeletonFrame } from '../layout/OmnichannelContactPageSkeletonFrame';

/** Mirror `OmnichannelContactPage` + Seamless Page Scroll (header ikut scroll). */
export function OmnichannelContactPageSkeleton() {
  const { t } = useAppTranslation();
  const aria = t('omnichannel.contact.loadingAria', 'Loading contacts');

  return (
    <OmnichannelContactPageSkeletonFrame
      ariaLabel={aria}
      toolbar={
        <div className="flex shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      }
    >
      <div className="min-h-0 min-w-0 flex-1 space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </OmnichannelContactPageSkeletonFrame>
  );
}

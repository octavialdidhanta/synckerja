import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  PAGE_ACCESS_MAIN_COLUMN,
  PAGE_ACCESS_MAIN_GRID,
  PAGE_ACCESS_SIDEBAR_COLUMN,
  PAGE_ACCESS_TABLE_SECTION,
} from '@/2-9-PageAccess/layout/pageAccessLayout';

type AccessPermissionsPageSkeletonProps = {
  srLabel?: string | null;
  className?: string;
};

export const AccessPermissionsPageSkeleton = ({
  srLabel,
  className,
}: AccessPermissionsPageSkeletonProps) => {
  const { t } = useAppTranslation();
  const label = srLabel === null ? null : (srLabel ?? t('pageAccess.page.loadingAria', 'Loading access permissions'));

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans',
        className,
      )}
      aria-busy
      aria-label={label ?? undefined}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                <div className="mb-1 shrink-0 px-1 py-3">
                  <div className="mb-3">
                    <Skeleton className="h-7 w-56" />
                    <Skeleton className="mt-2 h-4 w-80 max-w-full" />
                  </div>
                  <div className="-mb-3">
                    <Skeleton className="h-8 w-28" />
                  </div>
                </div>

                <div className={PAGE_ACCESS_MAIN_GRID}>
                  <div className={PAGE_ACCESS_MAIN_COLUMN}>
                    <div className={PAGE_ACCESS_TABLE_SECTION}>
                      <div className="bg-card border-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm">
                        <div className="border-border shrink-0 border-b px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-2">
                              <Skeleton className="h-6 w-56 max-w-full" />
                              <Skeleton className="h-4 w-80 max-w-full" />
                            </div>
                            <Skeleton className="h-9 w-32 shrink-0" />
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 p-4">
                          <Skeleton className="h-full min-h-[12rem] w-full" />
                        </div>
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-44 max-w-[55%]" />
                            <Skeleton className="h-3 w-24 max-w-[40%]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={PAGE_ACCESS_SIDEBAR_COLUMN}>
                    <div className={PAGE_ACCESS_TABLE_SECTION}>
                      <div className="bg-card border-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm">
                        <div className="shrink-0 border-b px-4 py-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="mt-2 h-3 w-36 max-w-full" />
                        </div>
                        <div className="min-h-0 flex-1 p-4">
                          <Skeleton className="h-full min-h-[200px] w-full" />
                        </div>
                        <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3 w-24 max-w-[55%]" />
                            <Skeleton className="h-3 w-16 max-w-[40%]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
};

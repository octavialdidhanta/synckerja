import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { IntegrationsPageSkeletonFrame } from '../layout/IntegrationsPageSkeletonFrame';
import { INTEGRATIONS_COLUMNS_THREADS } from '../layout/integrationsLayout';

/** Layout mirror for `/omnichannel/integrations/threads`. */
export function ThreadsConnectPageSkeleton() {
  const { t } = useAppTranslation();

  return (
    <IntegrationsPageSkeletonFrame
      ariaLabel={t('threadsConnect.loading', 'Memuat…')}
      columnsClassName={INTEGRATIONS_COLUMNS_THREADS}
      left={
        <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 space-y-1 pb-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <Skeleton className="h-7 w-36 max-w-full" />
                <Skeleton className="mt-0.5 h-3 w-44 max-w-full" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="scrollbar-hide nested-scroll-touch-chain seamless-scroll flex min-h-0 flex-1 flex-col space-y-3 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-[3.25rem] w-full rounded-lg" />
                <Skeleton className="h-[3.25rem] w-full rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="border-t border-slate-200 pt-3">
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>
          </CardContent>
        </Card>
      }
    >
      <CardHeader className="shrink-0 pb-3">
        <Skeleton className="h-5 w-36 max-w-full" />
      </CardHeader>
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="h-3 w-36 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-32 max-w-full" />
                <Skeleton className="h-3 w-40 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
          </div>
        </div>
      </CardContent>
    </IntegrationsPageSkeletonFrame>
  );
}

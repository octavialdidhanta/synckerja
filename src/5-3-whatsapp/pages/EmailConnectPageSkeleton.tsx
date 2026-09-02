import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { IntegrationsPageSkeletonFrame } from '../layout/IntegrationsPageSkeletonFrame';

/** Layout mirror for `/omnichannel/integrations/email`. */
export function EmailConnectPageSkeleton() {
  const { t } = useAppTranslation();

  return (
    <IntegrationsPageSkeletonFrame
      ariaLabel={t('emailConnect.loading', 'Loading...')}
      left={
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-3 w-full max-w-[280px]" />
                <Skeleton className="h-3 w-full max-w-[220px]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
      }
    >
      <CardHeader className="shrink-0 space-y-1.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3 w-full max-w-lg" />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-3 w-full max-w-xs" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-10" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-full max-w-sm" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-10" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </IntegrationsPageSkeletonFrame>
  );
}

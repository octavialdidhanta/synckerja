import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { IntegrationsPageSkeletonFrame } from '../layout/IntegrationsPageSkeletonFrame';

function InstagramAccountCardSkeleton() {
  return (
    <div className="rounded-xl border border-purple-200/70 bg-purple-50/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <Skeleton className="h-5 w-32 max-w-full" />
            <Skeleton className="mt-1 h-4 w-24 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

/** Layout mirror for `/omnichannel/integrations/instagram`. */
export function InstagramConnectPageSkeleton() {
  const { t } = useAppTranslation();

  return (
    <IntegrationsPageSkeletonFrame
      ariaLabel={t('instagramConnect.loadingAccounts', 'Loading...')}
      left={
        <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
              <Skeleton className="h-7 w-44 max-w-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="border-t border-slate-200 pt-3">
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>
          </CardContent>
        </Card>
      }
    >
      <CardHeader className="shrink-0">
        <Skeleton className="h-7 w-44 max-w-full" />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-hide nested-scroll-touch-chain seamless-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <InstagramAccountCardSkeleton />
          <InstagramAccountCardSkeleton />
        </div>
      </CardContent>
    </IntegrationsPageSkeletonFrame>
  );
}

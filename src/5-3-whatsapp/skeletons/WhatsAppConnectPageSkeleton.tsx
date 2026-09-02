import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { IntegrationsPageSkeletonFrame } from '../layout/IntegrationsPageSkeletonFrame';

/** Layout mirror for `/omnichannel/integrations/whatsapp`. */
export function WhatsAppConnectPageSkeleton() {
  const { t } = useAppTranslation();

  return (
    <IntegrationsPageSkeletonFrame
      ariaLabel={t('pageAccess.loading', 'Loading…')}
      left={
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col space-y-6 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
            </div>
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <Skeleton className="h-4 w-4 shrink-0 rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-64 max-w-full" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <Skeleton className="h-3 w-44" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      }
    >
      <CardHeader className="shrink-0 space-y-2">
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4">
          <div className="space-y-5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-48 max-w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-emerald-200/60 pt-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </div>
      </CardContent>
    </IntegrationsPageSkeletonFrame>
  );
}

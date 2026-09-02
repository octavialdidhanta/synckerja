import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { CampaignPageSkeletonFrame } from '../layout/CampaignPageSkeletonFrame';

/** Layout mirror for `/omnichannel/campaign/templates`. */
export function WhatsAppTemplatePageSkeleton() {
  const { t } = useAppTranslation();

  return (
    <CampaignPageSkeletonFrame ariaLabel={t('pageAccess.loading', 'Loading…')}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
        <div className="mb-0 flex flex-wrap gap-6 border-b border-slate-200 pb-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 min-w-[140px] flex-1 rounded-md" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
          <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
          <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="ml-auto flex shrink-0 gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-sm" />
          ))}
        </div>
      </div>
    </CampaignPageSkeletonFrame>
  );
}

import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { CampaignPageSkeletonFrame } from '../layout/CampaignPageSkeletonFrame';

/** Layout mirror for `/omnichannel/campaign/whatsapp`. */
export function WhatsAppCampaignPageSkeleton() {
  const { t } = useAppTranslation();

  return (
    <CampaignPageSkeletonFrame ariaLabel={t('whatsappTemplates.campaign.table.loading', 'Loading…')}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 justify-end px-4 pt-4">
          <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
        </div>
        <div className="mt-3 min-h-0 min-w-0 flex-1 space-y-2 px-3 pb-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
        </div>
      </div>
    </CampaignPageSkeletonFrame>
  );
}

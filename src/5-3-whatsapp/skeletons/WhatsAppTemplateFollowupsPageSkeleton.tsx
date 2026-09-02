import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { TemplateFollowupsPageSkeletonFrame } from '../layout/TemplateFollowupsPageSkeletonFrame';

type Props = {
  mode?: 'route' | 'overlay';
};

/** Mirror `WhatsAppTemplateFollowupsPage` + Seamless Page Scroll (header ikut scroll). */
export function WhatsAppTemplateFollowupsPageSkeleton({ mode = 'route' }: Props) {
  const { t } = useAppTranslation();
  const aria = t('whatsappTemplateFollowups.loadingAria', 'Loading template follow-ups');

  return (
    <TemplateFollowupsPageSkeletonFrame
      ariaLabel={aria}
      includeChrome={mode === 'route'}
    >
      <div className="min-h-0 min-w-0 flex-1 space-y-2 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-md" />
        ))}
      </div>
    </TemplateFollowupsPageSkeletonFrame>
  );
}

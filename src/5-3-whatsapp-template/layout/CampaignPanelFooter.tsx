import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

type Props = {
  count?: number;
  sectionLabel: string;
};

export function CampaignPanelFooter({ count = 0, sectionLabel }: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t('omnichannel.campaign.footer.showing', 'Showing {{count}} {{section}}', {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t('omnichannel.campaign.footer.total', 'Total: {{count}}', { count })}
        </span>
      </div>
    </div>
  );
}

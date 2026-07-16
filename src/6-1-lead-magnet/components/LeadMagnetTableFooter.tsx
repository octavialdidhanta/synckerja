import { useTranslation } from 'react-i18next';

type Props = {
  totalCampaigns: number;
  activeCampaigns: number;
};

export function LeadMagnetTableFooter({ totalCampaigns, activeCampaigns }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('leadMagnet.list.footerShowing', { count: totalCampaigns })}</span>
        <span>{t('leadMagnet.list.footerActive', { active: activeCampaigns })}</span>
      </div>
    </div>
  );
}

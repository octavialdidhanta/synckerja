import { useTranslation } from 'react-i18next';
import { summarizeCampaignLeadMagnet } from '../lib/summarizeCampaignLeadMagnet';
import type { LeadMagnetCampaign } from '../types/leadMagnet.types';
import { SUPABASE_URL } from '@/shared/lib/supabaseClient';
import { Button } from '@/shared/components/ui/button';

type Props = {
  campaign: LeadMagnetCampaign;
  onOpen: () => void;
};

export function CampaignLeadMagnetCell({ campaign, onOpen }: Props) {
  const { t } = useTranslation();
  const summary = summarizeCampaignLeadMagnet(campaign, SUPABASE_URL);

  if (!summary.hasContent) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <Button
      type="button"
      variant="link"
      className="h-auto max-w-[180px] justify-start px-0 py-0 text-left text-xs font-medium"
      onClick={onOpen}
    >
      <span className="truncate" title={summary.label}>
        {summary.label || t('leadMagnet.list.leadMagnetView')}
      </span>
    </Button>
  );
}

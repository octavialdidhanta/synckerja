import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import type { LeadMagnetCampaignMetrics } from '../types/leadMagnet.types';

const EMPTY_METRICS: LeadMagnetCampaignMetrics = {
  new_followers: 0,
  non_follower_at_start: 0,
  total_enrollments: 0,
};

type Props = {
  metrics?: LeadMagnetCampaignMetrics;
};

export function CampaignFollowerMetricCell({ metrics }: Props) {
  const { t } = useTranslation();
  const m = metrics ?? EMPTY_METRICS;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help font-semibold tabular-nums">
            {m.new_followers.toLocaleString('id-ID')}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p>{t('leadMagnet.list.newFollowersTooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

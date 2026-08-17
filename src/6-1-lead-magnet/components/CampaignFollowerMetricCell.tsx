import { CampaignMetricCell } from './CampaignMetricCell';
import type { LeadMagnetCampaignMetrics } from '../types/leadMagnet.types';

const EMPTY_METRICS: LeadMagnetCampaignMetrics = {
  new_leads: 0,
  offline_visits: 0,
  new_followers: 0,
  new_emails: 0,
  new_phones: 0,
  transactions: 0,
  revenue: 0,
  aov: 0,
  non_follower_at_start: 0,
  total_enrollments: 0,
};

type Props = {
  metrics?: LeadMagnetCampaignMetrics;
};

/** Follower count cell (list column). */
export function CampaignFollowerMetricCell({ metrics }: Props) {
  const m = metrics ?? EMPTY_METRICS;
  return (
    <CampaignMetricCell
      value={m.new_followers}
      tooltipKey="leadMagnet.list.newFollowersTooltip"
    />
  );
}

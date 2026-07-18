/** Build a readable funnel view from raw lead_magnet_funnel_events counts. */

export type FunnelEventCounts = Record<string, number>;

export type LeadMagnetFunnelStepView = {
  id: string;
  /** i18n key under leadMagnet.analytics.funnel.* */
  labelKey: string;
  count: number;
  /** Share of top-of-funnel (first step with count > 0, else 0). */
  pctOfTop: number;
  /** Conversion from previous visible step (null for first). */
  pctFromPrev: number | null;
};

export type LeadMagnetFunnelSideStat = {
  id: string;
  labelKey: string;
  count: number;
};

export type LeadMagnetFunnelView = {
  steps: LeadMagnetFunnelStepView[];
  sideStats: LeadMagnetFunnelSideStat[];
  topCount: number;
};

function countOf(funnel: FunnelEventCounts, ...keys: string[]): number {
  return keys.reduce((sum, key) => sum + (funnel[key] ?? 0), 0);
}

/**
 * Primary conversion path (event counts, not unique users).
 * Deliveries are summed across IG / WA / email / legacy delivered.
 */
export function buildLeadMagnetFunnelView(funnel: FunnelEventCounts): LeadMagnetFunnelView {
  const rawSteps: Array<{ id: string; labelKey: string; count: number }> = [
    { id: 'comment_matched', labelKey: 'commentMatched', count: countOf(funnel, 'comment_matched') },
    { id: 'comment_replied', labelKey: 'commentReplied', count: countOf(funnel, 'comment_replied') },
    {
      id: 'opening_or_follow_gate',
      labelKey: 'openingOrFollowGate',
      // Opening-first vs skip-opening are alternate entry paths — do not double-count.
      count: countOf(funnel, 'framework_offered') + countOf(funnel, 'material_offer_skipped'),
    },
    {
      id: 'follow_validated',
      labelKey: 'followValidated',
      count: countOf(funnel, 'follow_validated') + countOf(funnel, 'follow_gate_skipped_follower'),
    },
    {
      id: 'contact_collected',
      labelKey: 'contactCollected',
      count: countOf(funnel, 'contact_collected'),
    },
    {
      id: 'delivered',
      labelKey: 'delivered',
      count: countOf(
        funnel,
        'delivery_instagram_sent',
        'delivery_whatsapp_sent',
        'delivery_email_sent',
        'delivered',
      ),
    },
  ];

  const sideStats: LeadMagnetFunnelSideStat[] = [
    {
      id: 'follow_gate_sent',
      labelKey: 'followGateSent',
      count: countOf(funnel, 'follow_gate_sent'),
    },
    {
      id: 'follow_gate_skipped_follower',
      labelKey: 'followGateSkipped',
      count: countOf(funnel, 'follow_gate_skipped_follower'),
    },
    {
      id: 'contact_invalid',
      labelKey: 'contactInvalid',
      count: countOf(funnel, 'contact_invalid'),
    },
    {
      id: 'dm_failed',
      labelKey: 'dmFailed',
      count: countOf(funnel, 'dm_failed'),
    },
  ].filter((s) => s.count > 0);

  const topCount = rawSteps.find((s) => s.count > 0)?.count ?? 0;

  const steps: LeadMagnetFunnelStepView[] = rawSteps.map((step, index) => {
    const prev = index > 0 ? rawSteps[index - 1]!.count : null;
    const pctOfTop = topCount > 0 ? Math.round((step.count / topCount) * 1000) / 10 : 0;
    const pctFromPrev =
      prev != null && prev > 0 ? Math.round((step.count / prev) * 1000) / 10 : null;
    return {
      id: step.id,
      labelKey: step.labelKey,
      count: step.count,
      pctOfTop,
      pctFromPrev,
    };
  });

  return { steps, sideStats, topCount };
}

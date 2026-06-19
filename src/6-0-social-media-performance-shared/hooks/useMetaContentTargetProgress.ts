import { useMemo } from 'react';
import { useDigitalMarketingPaidAdsFilters } from '@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext';
import { useSocialMediaInsightTargetsQuery } from '@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetsQuery';
import {
  computeInsightTargetProgress,
  insightTargetProgressByMetric,
} from '@/6-0-social-media-performance-shared/insightTargetProgress';
import { resolveInsightTargetPeriod } from '@/6-0-social-media-performance-shared/insightTargetPeriod';
import {
  metaAccountRowForTargetProgress,
  metaMetricsToInsightSummary,
} from '@/6-0-social-media-performance-shared/platformContentInsightTargetProgress';
import type {
  InsightTargetPeriodKey,
  InsightTargetProgress,
} from '@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes';
import type { MetaContentMetricsPayload, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';

export function useMetaContentTargetProgress(args: {
  platform: MetaContentPlatform;
  accountId: string;
  account: MetaContentMetricsPayload['account'] | null | undefined;
  accountLabel?: string | null;
  avatarUrl?: string | null;
  enabled?: boolean;
}) {
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();
  const enabled = args.enabled !== false && Boolean(args.accountId);

  const resolvedPeriod = useMemo(
    () => resolveInsightTargetPeriod(dateSelection),
    [dateSelection],
  );

  const periodKey: InsightTargetPeriodKey | null =
    resolvedPeriod && enabled
      ? {
          periodType: resolvedPeriod.periodType,
          year: resolvedPeriod.year,
          month: resolvedPeriod.month,
          quarter: resolvedPeriod.quarter,
        }
      : null;

  const targetsQuery = useSocialMediaInsightTargetsQuery(periodKey);

  const progressList: InsightTargetProgress[] = useMemo(() => {
    if (!enabled || !args.account) return [];
    const insightSummary = metaMetricsToInsightSummary(args.account);
    const accountRow = metaAccountRowForTargetProgress(
      args.platform,
      args.accountId,
      args.account,
      args.accountLabel ?? null,
      args.avatarUrl ?? null,
    );
    return computeInsightTargetProgress({
      summary: insightSummary,
      accounts: [accountRow],
      platformFilter: args.platform,
      dateSelection,
      targetRows: targetsQuery.data ?? [],
    });
  }, [
    enabled,
    args.account,
    args.platform,
    args.accountId,
    args.accountLabel,
    args.avatarUrl,
    dateSelection,
    targetsQuery.data,
  ]);

  const progressByMetric = useMemo(
    () => insightTargetProgressByMetric(progressList),
    [progressList],
  );

  return {
    progressList,
    progressByMetric,
    targetsLoading: enabled && targetsQuery.isLoading && periodKey != null,
    periodKey,
    showProgress: resolvedPeriod != null,
  };
}

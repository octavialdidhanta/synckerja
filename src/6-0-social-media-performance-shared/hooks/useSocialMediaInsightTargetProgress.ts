import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useSocialMediaInsightTargetsQuery } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetsQuery";
import {
  computeInsightTargetProgress,
  insightTargetProgressByMetric,
} from "@/6-0-social-media-performance-shared/insightTargetProgress";
import { resolveInsightTargetPeriod } from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import type {
  InsightTargetProgress,
  InsightTargetPeriodKey,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightSummary,
  SocialMediaPlatformFilter,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";

export function useSocialMediaInsightTargetProgress(args: {
  summary: SocialMediaInsightSummary;
  accounts: SocialMediaInsightAccountRow[];
  platformFilter: SocialMediaPlatformFilter;
}) {
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();
  const resolvedPeriod = useMemo(
    () => resolveInsightTargetPeriod(dateSelection),
    [dateSelection],
  );

  const periodKey: InsightTargetPeriodKey | null = resolvedPeriod
    ? {
        periodType: resolvedPeriod.periodType,
        year: resolvedPeriod.year,
        month: resolvedPeriod.month,
        quarter: resolvedPeriod.quarter,
      }
    : null;

  const targetsQuery = useSocialMediaInsightTargetsQuery(periodKey);

  const progressList: InsightTargetProgress[] = useMemo(
    () =>
      computeInsightTargetProgress({
        summary: args.summary,
        accounts: args.accounts,
        platformFilter: args.platformFilter,
        dateSelection,
        targetRows: targetsQuery.data ?? [],
      }),
    [
      args.summary,
      args.accounts,
      args.platformFilter,
      dateSelection,
      targetsQuery.data,
    ],
  );

  const progressByMetric = useMemo(
    () => insightTargetProgressByMetric(progressList),
    [progressList],
  );

  return {
    progressList,
    progressByMetric,
    targetsLoading: targetsQuery.isLoading && periodKey != null,
    periodKey,
    resolvedPeriod,
  };
}

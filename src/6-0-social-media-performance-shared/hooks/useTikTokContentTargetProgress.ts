import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useSocialMediaInsightTargetsQuery } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetsQuery";
import {
  computeInsightTargetProgress,
  insightTargetProgressByMetric,
} from "@/6-0-social-media-performance-shared/insightTargetProgress";
import { resolveInsightTargetPeriod } from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import {
  tiktokAccountRowForTargetProgress,
  tiktokSummaryToInsightSummary,
} from "@/6-0-social-media-performance-shared/platformContentInsightTargetProgress";
import type {
  InsightTargetPeriodKey,
  InsightTargetProgress,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { TikTokContentVideosResponse } from "@/tiktok-content/hooks/useTikTokContentVideosQuery";

export function useTikTokContentTargetProgress(args: {
  openId: string;
  summary: TikTokContentVideosResponse["summary"] | null | undefined;
  accountLabel?: string | null;
  enabled?: boolean;
}) {
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();
  const enabled = args.enabled !== false && Boolean(args.openId);

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
    if (!enabled || !args.summary) return [];
    const insightSummary = tiktokSummaryToInsightSummary(args.summary);
    const account = tiktokAccountRowForTargetProgress(
      args.openId,
      args.summary,
      args.accountLabel ?? null,
    );
    return computeInsightTargetProgress({
      summary: insightSummary,
      accounts: [account],
      platformFilter: "tiktok",
      dateSelection,
      targetRows: targetsQuery.data ?? [],
    });
  }, [
    enabled,
    args.summary,
    args.openId,
    args.accountLabel,
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

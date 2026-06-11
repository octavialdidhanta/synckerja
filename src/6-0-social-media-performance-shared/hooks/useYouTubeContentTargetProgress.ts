import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { useSocialMediaInsightTargetsQuery } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetsQuery";
import {
  computeInsightTargetProgress,
  insightTargetProgressByMetric,
} from "@/6-0-social-media-performance-shared/insightTargetProgress";
import { resolveInsightTargetPeriod } from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import {
  youtubeAccountRowForTargetProgress,
  youtubeSummaryToInsightSummary,
} from "@/6-0-social-media-performance-shared/platformContentInsightTargetProgress";
import type {
  InsightTargetPeriodKey,
  InsightTargetProgress,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";
import type { YouTubeContentVideosResponse } from "@/youtube-content/hooks/useYouTubeContentVideosQuery";

export function useYouTubeContentTargetProgress(args: {
  channelId: string;
  summary: YouTubeContentVideosResponse["summary"] | null | undefined;
  accountLabel?: string | null;
  enabled?: boolean;
}) {
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();
  const enabled = args.enabled !== false && Boolean(args.channelId);

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
    const insightSummary = youtubeSummaryToInsightSummary(args.summary);
    const account = youtubeAccountRowForTargetProgress(
      args.channelId,
      args.summary,
      args.accountLabel ?? null,
    );
    return computeInsightTargetProgress({
      summary: insightSummary,
      accounts: [account],
      platformFilter: "youtube",
      dateSelection,
      targetRows: targetsQuery.data ?? [],
    });
  }, [
    enabled,
    args.summary,
    args.channelId,
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

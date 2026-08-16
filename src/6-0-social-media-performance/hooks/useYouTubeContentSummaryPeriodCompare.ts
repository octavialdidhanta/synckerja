import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import {
  fetchYouTubeContentVideos,
  type YouTubeContentVideosResponse,
} from "@/youtube-content/hooks/useYouTubeContentVideosQuery";

export type YouTubeContentCompareCardKey =
  | "videos"
  | "views"
  | "likes"
  | "comments"
  | "engagement";

type Summary = YouTubeContentVideosResponse["summary"];

type Args = {
  organizationId: string | null | undefined;
  channelId: string | null | undefined;
  dateStart: string | null | undefined;
  dateEnd: string | null | undefined;
  enabled: boolean;
};

function formatCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

export function youtubeContentSummaryNumericValue(
  key: YouTubeContentCompareCardKey,
  summary: Summary | null | undefined,
): number | null {
  if (!summary) return null;
  switch (key) {
    case "videos":
      return Number.isFinite(summary.video_count) ? summary.video_count : null;
    case "views":
      return Number.isFinite(summary.total_views) ? summary.total_views : null;
    case "likes":
      return Number.isFinite(summary.total_likes) ? summary.total_likes : null;
    case "comments":
      return Number.isFinite(summary.total_comments) ? summary.total_comments : null;
    case "engagement":
      return summary.avg_engagement_rate;
    default:
      return null;
  }
}

export function formatYouTubeContentCompareValue(
  key: YouTubeContentCompareCardKey,
  summary: Summary | null | undefined,
): string {
  if (!summary) return "—";
  switch (key) {
    case "videos":
      return formatCount(summary.video_count);
    case "views":
      return formatCount(summary.total_views);
    case "likes":
      return formatCount(summary.total_likes);
    case "comments":
      return formatCount(summary.total_comments);
    case "engagement":
      return formatPercent(summary.avg_engagement_rate);
    default:
      return "—";
  }
}

export function useYouTubeContentSummaryPeriodCompare({
  organizationId,
  channelId,
  dateStart,
  dateEnd,
  enabled,
}: Args) {
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();

  const previousRange = useMemo(
    () => resolvePreviousPaidAdsDateRange(dateSelection, dateStart ?? null, dateEnd ?? null),
    [dateSelection, dateStart, dateEnd],
  );

  const compareQueryEnabled =
    enabled && Boolean(organizationId) && Boolean(channelId) && Boolean(previousRange);

  const query = useQuery({
    queryKey: [
      "youtube-content-videos-compare",
      organizationId,
      channelId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !channelId || !previousRange) {
        throw new Error("Missing organization, channel, or previous range");
      }
      return fetchYouTubeContentVideos({
        organizationId,
        channelId,
        dateStart: previousRange.fromDate,
        dateEnd: previousRange.toDate,
        allVideos: false,
        filterByPublishDate: false,
      });
    },
    enabled: compareQueryEnabled,
    staleTime: 60_000,
    retry: false,
  });

  return {
    previousRange,
    previousSummary: query.data?.summary ?? null,
    compareLoading: compareQueryEnabled && query.isPending,
    compareError: query.isError,
  };
}

export function youtubeContentPeriodCompareBits(args: {
  cardKey: YouTubeContentCompareCardKey;
  currentSummary: Summary | null | undefined;
  previousSummary: Summary | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
}) {
  const visible = Boolean(args.previousRange) && !args.compareError;
  const current = youtubeContentSummaryNumericValue(args.cardKey, args.currentSummary ?? null);
  const previous = youtubeContentSummaryNumericValue(args.cardKey, args.previousSummary ?? null);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatYouTubeContentCompareValue(
    args.cardKey,
    args.previousSummary ?? null,
  );
  return {
    compareDelta,
    compareRangeLabel,
    comparePreviousText,
    compareLoading: visible && args.compareLoading,
    compareVisible: visible,
    compareMetricKey: args.cardKey,
  };
}

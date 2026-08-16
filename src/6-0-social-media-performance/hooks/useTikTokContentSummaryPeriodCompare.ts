import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import {
  fetchTikTokContentVideos,
  type TikTokContentVideosResponse,
} from "@/tiktok-content/hooks/useTikTokContentVideosQuery";

export type TikTokContentCompareCardKey =
  | "videos"
  | "views"
  | "likes"
  | "comments"
  | "engagement";

type Summary = TikTokContentVideosResponse["summary"];

type Args = {
  organizationId: string | null | undefined;
  openId: string | null | undefined;
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

export function tiktokContentSummaryNumericValue(
  key: TikTokContentCompareCardKey,
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

export function formatTikTokContentCompareValue(
  key: TikTokContentCompareCardKey,
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

export function useTikTokContentSummaryPeriodCompare({
  organizationId,
  openId,
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
    enabled && Boolean(organizationId) && Boolean(openId) && Boolean(previousRange);

  const query = useQuery({
    queryKey: [
      "tiktok-content-videos-compare",
      organizationId,
      openId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !openId || !previousRange) {
        throw new Error("Missing organization, open id, or previous range");
      }
      return fetchTikTokContentVideos({
        organizationId,
        openId,
        dateStart: previousRange.fromDate,
        dateEnd: previousRange.toDate,
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

export function tiktokContentPeriodCompareBits(args: {
  cardKey: TikTokContentCompareCardKey;
  currentSummary: Summary | null | undefined;
  previousSummary: Summary | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
}) {
  const visible = Boolean(args.previousRange) && !args.compareError;
  const current = tiktokContentSummaryNumericValue(args.cardKey, args.currentSummary ?? null);
  const previous = tiktokContentSummaryNumericValue(args.cardKey, args.previousSummary ?? null);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatTikTokContentCompareValue(
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

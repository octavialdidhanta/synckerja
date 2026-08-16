import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import { aggregateMetaContentPostRows } from "@/meta-content/lib/aggregateMetaContentPostRows";
import { fetchMetaContentMetrics } from "@/meta-content/hooks/useMetaContentMetrics";
import type { MetaContentMetricsPayload, MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";

export type MetaContentCompareCardKey =
  | "reach"
  | "views"
  | "engagement"
  | "posts"
  | "avgEngagement"
  | "likes"
  | "comments";

export type MetaContentCompareSnapshot = {
  reach: number;
  views: number;
  viewsComparable: boolean;
  engagement: number;
  posts: number;
  likes: number;
  comments: number;
  avgEngagement: number | null;
};

type Args = {
  organizationId: string | null | undefined;
  platform: MetaContentPlatform;
  accountId: string | null | undefined;
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

function usesIgAvgLast3Views(
  account: MetaContentMetricsPayload["account"] | null | undefined,
): boolean {
  return (
    account?.platform === "instagram" &&
    (account.views_mode === "avg_last_3" || account.avg_views_last_3 != null)
  );
}

export function buildMetaContentCompareSnapshot(
  payload:
    | {
        account?: MetaContentMetricsPayload["account"] | null;
        posts?: MetaContentMetricsPayload["posts"];
      }
    | null
    | undefined,
): MetaContentCompareSnapshot | null {
  if (!payload) return null;
  const posts = payload.posts ?? [];
  const account = payload.account;
  const totals = aggregateMetaContentPostRows(posts);
  const useIgAvgLast3 = usesIgAvgLast3Views(account);
  const avgEngagementRate =
    account?.avg_engagement_rate ??
    (totals.engagement > 0 && totals.views > 0 ? (totals.engagement / totals.views) * 100 : null);

  return {
    reach: totals.reach,
    views: useIgAvgLast3
      ? Number(account?.avg_views_last_3 ?? account?.total_views ?? totals.views) || 0
      : totals.views,
    viewsComparable: !useIgAvgLast3,
    engagement: totals.engagement,
    posts: totals.postCount,
    likes: totals.likes,
    comments: totals.comments,
    avgEngagement: avgEngagementRate,
  };
}

export function metaContentSummaryNumericValue(
  key: MetaContentCompareCardKey,
  snapshot: MetaContentCompareSnapshot | null | undefined,
): number | null {
  if (!snapshot) return null;
  switch (key) {
    case "reach":
      return snapshot.reach;
    case "views":
      return snapshot.viewsComparable ? snapshot.views : null;
    case "engagement":
      return snapshot.engagement;
    case "posts":
      return snapshot.posts;
    case "likes":
      return snapshot.likes;
    case "comments":
      return snapshot.comments;
    case "avgEngagement":
      return snapshot.avgEngagement;
    default:
      return null;
  }
}

export function formatMetaContentCompareValue(
  key: MetaContentCompareCardKey,
  snapshot: MetaContentCompareSnapshot | null | undefined,
): string {
  if (!snapshot) return "—";
  switch (key) {
    case "reach":
      return formatCount(snapshot.reach);
    case "views":
      return formatCount(snapshot.views);
    case "engagement":
      return formatCount(snapshot.engagement);
    case "posts":
      return formatCount(snapshot.posts);
    case "likes":
      return formatCount(snapshot.likes);
    case "comments":
      return formatCount(snapshot.comments);
    case "avgEngagement":
      return formatPercent(snapshot.avgEngagement);
    default:
      return "—";
  }
}

export function useMetaContentSummaryPeriodCompare({
  organizationId,
  platform,
  accountId,
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
    enabled && Boolean(organizationId) && Boolean(accountId) && Boolean(previousRange);

  const query = useQuery({
    queryKey: [
      "meta-content-metrics-compare",
      organizationId,
      platform,
      accountId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !accountId || !previousRange) {
        throw new Error("Missing organization, account, or previous range");
      }
      return fetchMetaContentMetrics({
        organizationId,
        platform,
        accountId,
        dateStart: previousRange.fromDate,
        dateEnd: previousRange.toDate,
      });
    },
    enabled: compareQueryEnabled,
    staleTime: 60_000,
    retry: false,
  });

  const previousSnapshot = useMemo(
    () => (query.data ? buildMetaContentCompareSnapshot(query.data) : null),
    [query.data],
  );

  return {
    previousRange,
    previousSnapshot,
    compareLoading: compareQueryEnabled && query.isPending,
    compareError: query.isError,
  };
}

export function metaContentPeriodCompareBits(args: {
  cardKey: MetaContentCompareCardKey;
  currentSnapshot: MetaContentCompareSnapshot | null | undefined;
  previousSnapshot: MetaContentCompareSnapshot | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
}) {
  const viewsComparable =
    args.cardKey !== "views" || args.currentSnapshot?.viewsComparable !== false;
  const visible = Boolean(args.previousRange) && !args.compareError && viewsComparable;
  const current = metaContentSummaryNumericValue(args.cardKey, args.currentSnapshot ?? null);
  const previous = metaContentSummaryNumericValue(args.cardKey, args.previousSnapshot ?? null);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatMetaContentCompareValue(
    args.cardKey,
    args.previousSnapshot ?? null,
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

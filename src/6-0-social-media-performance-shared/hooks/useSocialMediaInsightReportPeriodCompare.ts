import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import {
  fetchInsightAccountMetrics,
  INSIGHT_FETCH_CONCURRENCY,
  mapWithConcurrency,
} from "@/6-0-social-media-performance-shared/fetchInsightAccountMetrics";
import { useSocialMediaInsightTargetAccounts } from "@/6-0-social-media-performance-shared/hooks/useSocialMediaInsightTargetAccounts";
import { computeInsightSummary } from "@/6-0-social-media-performance-shared/socialMediaInsightMonthlyTrend";
import type {
  SocialMediaInsightAccountRow,
  SocialMediaInsightSummary,
  SocialMediaPlatformFilter,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

export type InsightReportCompareCardKey =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "avg_engagement_rate";

type Args = {
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

export function insightReportSummaryForFilter(
  accounts: SocialMediaInsightAccountRow[],
  platformFilter: SocialMediaPlatformFilter,
): SocialMediaInsightSummary {
  const rows =
    platformFilter === "all" ? accounts : accounts.filter((a) => a.platform === platformFilter);
  return computeInsightSummary(rows);
}

export function insightReportSummaryNumericValue(
  key: InsightReportCompareCardKey,
  summary: SocialMediaInsightSummary | null | undefined,
): number | null {
  if (!summary) return null;
  switch (key) {
    case "views":
      return Number.isFinite(summary.totalViews) ? summary.totalViews : null;
    case "likes":
      return Number.isFinite(summary.totalLikes) ? summary.totalLikes : null;
    case "comments":
      return Number.isFinite(summary.totalComments) ? summary.totalComments : null;
    case "shares":
      return Number.isFinite(summary.totalShares) ? summary.totalShares : null;
    case "avg_engagement_rate":
      return summary.avgEngagementRate;
    default:
      return null;
  }
}

export function formatInsightReportCompareValue(
  key: InsightReportCompareCardKey,
  summary: SocialMediaInsightSummary | null | undefined,
): string {
  if (!summary) return "—";
  switch (key) {
    case "views":
      return formatCount(summary.totalViews);
    case "likes":
      return formatCount(summary.totalLikes);
    case "comments":
      return formatCount(summary.totalComments);
    case "shares":
      return formatCount(summary.totalShares);
    case "avg_engagement_rate":
      return formatPercent(summary.avgEngagementRate);
    default:
      return "—";
  }
}

export function useSocialMediaInsightReportPeriodCompare({
  dateStart,
  dateEnd,
  enabled,
}: Args) {
  const { organizationId } = useCurrentOrg();
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();
  const { accounts: accountRefs, isLoading: accountsLoading } =
    useSocialMediaInsightTargetAccounts();

  const previousRange = useMemo(
    () => resolvePreviousPaidAdsDateRange(dateSelection, dateStart ?? null, dateEnd ?? null),
    [dateSelection, dateStart, dateEnd],
  );

  const compareQueryEnabled =
    enabled &&
    Boolean(organizationId) &&
    Boolean(previousRange) &&
    !accountsLoading &&
    accountRefs.length > 0;

  const query = useQuery({
    queryKey: [
      "social-media-insight-report-compare",
      organizationId,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !previousRange) return [] as SocialMediaInsightAccountRow[];
      return mapWithConcurrency(accountRefs, INSIGHT_FETCH_CONCURRENCY, (account) =>
        fetchInsightAccountMetrics(
          organizationId,
          account,
          previousRange.fromDate,
          previousRange.toDate,
        ),
      );
    },
    enabled: compareQueryEnabled,
    staleTime: 60_000,
    retry: false,
  });

  return {
    previousRange,
    previousAccounts: query.data ?? [],
    compareLoading: compareQueryEnabled && query.isPending,
    compareError: query.isError,
  };
}

export function insightReportPeriodCompareBits(args: {
  cardKey: InsightReportCompareCardKey;
  currentSummary: SocialMediaInsightSummary | null | undefined;
  previousSummary: SocialMediaInsightSummary | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
}) {
  const visible = Boolean(args.previousRange) && !args.compareError;
  const current = insightReportSummaryNumericValue(args.cardKey, args.currentSummary ?? null);
  const previous = insightReportSummaryNumericValue(args.cardKey, args.previousSummary ?? null);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatInsightReportCompareValue(
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

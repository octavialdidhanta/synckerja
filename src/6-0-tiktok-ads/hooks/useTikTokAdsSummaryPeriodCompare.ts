import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import {
  fetchTikTokAdsMetrics,
  type TikTokAdsMetricEntity,
} from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import {
  buildTikTokAdsSummaryTotals,
  formatTikTokAdsSummaryMetricValue,
  tiktokAdsCompareToneKey,
  tiktokAdsSummaryNumericValue,
  type TikTokAdsSummaryTotals,
  type TikTokAdsTableMetricKey,
} from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";

type Args = {
  organizationId: string | null | undefined;
  advertiserId: string | null | undefined;
  entity: TikTokAdsMetricEntity;
  dateStart: string | null | undefined;
  dateEnd: string | null | undefined;
  enabled: boolean;
};

export function useTikTokAdsSummaryPeriodCompare({
  organizationId,
  advertiserId,
  entity,
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
    enabled &&
    Boolean(organizationId) &&
    Boolean(advertiserId) &&
    Boolean(previousRange);

  const query = useQuery({
    queryKey: [
      "tiktok-ads-metrics-compare",
      organizationId,
      advertiserId,
      entity,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !advertiserId || !previousRange) {
        throw new Error("Missing organization, advertiser, or previous range");
      }
      return fetchTikTokAdsMetrics({
        organizationId,
        advertiserId,
        entity,
        dateStart: previousRange.fromDate,
        dateEnd: previousRange.toDate,
        pageToken: "",
      });
    },
    enabled: compareQueryEnabled,
    staleTime: 60_000,
    retry: false,
  });

  const previousTotals = useMemo(() => {
    if (!query.data?.summary) return null;
    return buildTikTokAdsSummaryTotals(query.data.summary, query.data.rows ?? [], entity);
  }, [query.data, entity]);

  return {
    previousRange,
    previousTotals,
    compareLoading: compareQueryEnabled && query.isPending,
    compareError: query.isError,
  };
}

export function tiktokAdsPeriodCompareBits(args: {
  metricKey: TikTokAdsTableMetricKey;
  currentTotals: TikTokAdsSummaryTotals | null | undefined;
  previousTotals: TikTokAdsSummaryTotals | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
}) {
  const visible = Boolean(args.previousRange) && !args.compareError;
  const current = tiktokAdsSummaryNumericValue(args.metricKey, args.currentTotals ?? null);
  const previous = tiktokAdsSummaryNumericValue(args.metricKey, args.previousTotals ?? null);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatTikTokAdsSummaryMetricValue(
    args.metricKey,
    args.previousTotals ?? null,
  );
  return {
    compareDelta,
    compareRangeLabel,
    comparePreviousText,
    compareLoading: visible && args.compareLoading,
    compareVisible: visible,
    compareMetricKey: tiktokAdsCompareToneKey(args.metricKey),
  };
}

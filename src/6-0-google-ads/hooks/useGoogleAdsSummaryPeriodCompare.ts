import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import {
  fetchGoogleAdsMetrics,
  type GoogleAdsMetricsFilters,
} from "@/google-ads/hooks/useGoogleAdsMetricsQuery";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import { summaryValueForKey } from "@/google-ads/metrics/summaryValueForKey";
import type {
  GoogleAdsMetricsSummaryTotals,
  GoogleAdsSummaryMetricOption,
} from "@/google-ads/metrics/types";

type Args = {
  organizationId: string | null | undefined;
  filters: GoogleAdsMetricsFilters | null;
  enabled: boolean;
};

export function useGoogleAdsSummaryPeriodCompare({ organizationId, filters, enabled }: Args) {
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();

  const previousRange = useMemo(() => {
    const start = filters?.dateRange.start ?? null;
    const end = filters?.dateRange.end ?? null;
    return resolvePreviousPaidAdsDateRange(dateSelection, start, end);
  }, [dateSelection, filters?.dateRange.start, filters?.dateRange.end]);

  const compareFilters = useMemo((): GoogleAdsMetricsFilters | null => {
    if (!filters || !previousRange) return null;
    return {
      ...filters,
      dateRange: { start: previousRange.fromDate, end: previousRange.toDate },
      pageToken: "",
      pageSize: 1,
    };
  }, [filters, previousRange]);

  const compareQueryEnabled =
    enabled &&
    Boolean(organizationId) &&
    Boolean(compareFilters?.customerId) &&
    Boolean(previousRange);

  const query = useQuery({
    queryKey: [
      "google-ads-metrics-compare",
      organizationId,
      compareFilters?.customerId,
      compareFilters?.entity,
      compareFilters?.metrics ? [...compareFilters.metrics].sort().join("|") : "",
      compareFilters?.dateRange,
      compareFilters?.onlyRunning,
      compareFilters?.statusFilter,
      compareFilters?.campaignFilterId ?? "",
      compareFilters?.adGroupFilterId ?? "",
      compareFilters?.summaryMetrics?.join("|") ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !compareFilters?.customerId) {
        throw new Error("Missing organization or customer");
      }
      return fetchGoogleAdsMetrics(organizationId, compareFilters);
    },
    enabled: compareQueryEnabled,
    staleTime: 60_000,
    retry: false,
  });

  return {
    previousRange,
    previousTotals: query.data?.summary_totals ?? null,
    compareLoading: compareQueryEnabled && query.isPending,
    compareError: query.isError,
  };
}

export function googleAdsPeriodCompareBits(args: {
  metricKey: string;
  valueKind: GoogleAdsSummaryMetricOption["valueKind"];
  currentTotals: GoogleAdsMetricsSummaryTotals | null | undefined;
  previousTotals: GoogleAdsMetricsSummaryTotals | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
  currencyCode: string | null;
}) {
  const visible = Boolean(args.previousRange) && !args.compareError;
  const current = summaryValueForKey(args.currentTotals, args.metricKey, args.valueKind);
  const previous = summaryValueForKey(args.previousTotals, args.metricKey, args.valueKind);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatMetricValue(
    args.metricKey,
    previous,
    args.currencyCode,
    args.valueKind,
  );
  return {
    compareDelta,
    compareRangeLabel,
    comparePreviousText,
    compareLoading: visible && args.compareLoading,
    compareVisible: visible,
    compareMetricKey: args.metricKey,
  };
}

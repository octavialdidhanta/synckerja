import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import { resolvePreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import type { PreviousPaidAdsDateRange } from "@/6-0-digital-marketing-shared/lib/resolvePreviousPaidAdsDateRange";
import { computeKpiCompareDelta, formatCompareDateRange } from "@/6-0-digital-marketing-shared/lib/kpiPeriodCompare";
import {
  fetchMetaAdsMetrics,
  type MetaAdsMetricEntity,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  buildMetaAdsSummaryTotals,
  formatMetaAdsSummaryMetricValue,
  metaAdsCompareToneKey,
  metaAdsSummaryNumericValue,
  type MetaAdsSummaryTotals,
  type MetaAdsTableMetricKey,
} from "@/meta-ads/metrics/metaAdsSummaryMetrics";

type Args = {
  organizationId: string | null | undefined;
  adAccountId: string | null | undefined;
  entity: MetaAdsMetricEntity;
  dateStart: string | null | undefined;
  dateEnd: string | null | undefined;
  enabled: boolean;
};

export function useMetaAdsSummaryPeriodCompare({
  organizationId,
  adAccountId,
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
    Boolean(adAccountId) &&
    Boolean(previousRange);

  const query = useQuery({
    queryKey: [
      "meta-ads-metrics-compare",
      organizationId,
      adAccountId,
      entity,
      previousRange?.fromDate ?? "",
      previousRange?.toDate ?? "",
    ],
    queryFn: async () => {
      if (!organizationId || !adAccountId || !previousRange) {
        throw new Error("Missing organization, ad account, or previous range");
      }
      return fetchMetaAdsMetrics({
        organizationId,
        adAccountId,
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
    return buildMetaAdsSummaryTotals(query.data.summary, query.data.rows ?? [], entity);
  }, [query.data, entity]);

  return {
    previousRange,
    previousTotals,
    compareLoading: compareQueryEnabled && query.isPending,
    compareError: query.isError,
  };
}

export function metaAdsPeriodCompareBits(args: {
  metricKey: MetaAdsTableMetricKey;
  currentTotals: MetaAdsSummaryTotals | null | undefined;
  previousTotals: MetaAdsSummaryTotals | null | undefined;
  previousRange: PreviousPaidAdsDateRange | null;
  compareLoading: boolean;
  compareError?: boolean;
}) {
  const visible = Boolean(args.previousRange) && !args.compareError;
  const current = metaAdsSummaryNumericValue(args.metricKey, args.currentTotals ?? null);
  const previous = metaAdsSummaryNumericValue(args.metricKey, args.previousTotals ?? null);
  const compareDelta =
    visible && !args.compareLoading ? computeKpiCompareDelta(current, previous) : null;
  const compareRangeLabel = args.previousRange
    ? formatCompareDateRange(args.previousRange.fromDate, args.previousRange.toDate, new Date(), {
        compact: true,
      })
    : "";
  const comparePreviousText = formatMetaAdsSummaryMetricValue(
    args.metricKey,
    args.previousTotals ?? null,
  );
  return {
    compareDelta,
    compareRangeLabel,
    comparePreviousText,
    compareLoading: visible && args.compareLoading,
    compareVisible: visible,
    compareMetricKey: metaAdsCompareToneKey(args.metricKey),
  };
}

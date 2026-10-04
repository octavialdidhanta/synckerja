import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  normalizeMetricDirectionsForMetrics,
  parseMetricDirectionsFromSettings,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import {
  mergeDmReportTargetRows,
  savedDmBaselineValue,
} from "@/6-0-digital-marketing-shared/dmReportTargetBaseline";
import { emptyChannelMetricsMap } from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import {
  dmTargetPeriodCacheKey,
  periodKeyFromResolved,
  previousDmReportTargetPeriod,
  quarterlyPeriodContainingMonth,
  resolveDmReportTargetPeriod,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import type {
  DmAccountPeriodActuals,
  DmReportTargetPeriodKey,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useDmReportPeriodActuals } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodActuals";
import { useDmReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodSettingsQuery";
import { useDmReportTargetsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetsQuery";
import {
  computeMetaAdsPageTargetProgress,
  metaAdsTableMetricKeyToTargetMetricKey,
  metaTargetProgressByTableMetric,
} from "@/6-0-digital-marketing-shared/metaAdsPageTargetProgress";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsTableMetricKey } from "@/meta-ads/metrics/metaAdsSummaryMetrics";

export function useMetaAdsReportTargetProgress(args: {
  adAccountId: string | null;
  summary: { spend: number; impressions: number; clicks: number; currency: string } | null | undefined;
  rows: MetaAdsMetricsRow[];
  tableMetricKeys: MetaAdsTableMetricKey[];
}) {
  const { dateSelection } = useDigitalMarketingPaidAdsFilters();
  const resolvedPeriod = useMemo(
    () => resolveDmReportTargetPeriod(dateSelection),
    [dateSelection],
  );

  const periodKey: DmReportTargetPeriodKey | null = resolvedPeriod
    ? periodKeyFromResolved(resolvedPeriod)
    : null;

  const targetsQuery = useDmReportTargetsQuery(periodKey);
  const quarterFallbackKey = useMemo(() => {
    if (!periodKey || periodKey.periodType !== "monthly" || periodKey.month == null) return null;
    return quarterlyPeriodContainingMonth(periodKey.year, periodKey.month);
  }, [periodKey]);
  const quarterTargetsQuery = useDmReportTargetsQuery(quarterFallbackKey);
  const periodSettingsQuery = useDmReportPeriodSettingsQuery(periodKey);

  const targetRows = useMemo(
    () => mergeDmReportTargetRows(targetsQuery.data ?? [], quarterTargetsQuery.data ?? []),
    [targetsQuery.data, quarterTargetsQuery.data],
  );

  const selectedReportMetrics = useMemo(() => {
    const fromSettings = periodSettingsQuery.data?.selected_metrics_by_channel?.meta ?? [];
    const fromCards = args.tableMetricKeys
      .map(metaAdsTableMetricKeyToTargetMetricKey)
      .filter((key): key is string => key != null);
    const fromTargets = targetRows
      .filter(
        (row) =>
          row.channel === "meta" &&
          (!args.adAccountId || row.account_id === args.adAccountId),
      )
      .map((row) => row.metric_key);
    return [...new Set([...fromSettings, ...fromCards, ...fromTargets])];
  }, [
    periodSettingsQuery.data?.selected_metrics_by_channel?.meta,
    args.tableMetricKeys,
    targetRows,
    args.adAccountId,
  ]);

  const rowsMissingBaseline = useMemo(
    () =>
      targetRows.filter(
        (row) =>
          row.channel === "meta" &&
          savedDmBaselineValue(row) == null &&
          (!args.adAccountId || row.account_id === args.adAccountId),
      ),
    [targetRows, args.adAccountId],
  );
  const needsPreviousMonth = rowsMissingBaseline.some((row) => row.period_type === "monthly");
  const needsPreviousQuarter = rowsMissingBaseline.some((row) => row.period_type === "quarterly");

  const previousMonthKey = useMemo(() => {
    if (!needsPreviousMonth || periodKey?.periodType !== "monthly") return null;
    return previousDmReportTargetPeriod(periodKey);
  }, [needsPreviousMonth, periodKey]);

  const previousQuarterKey = useMemo(() => {
    if (!needsPreviousQuarter) return null;
    const quarterPeriod =
      periodKey?.periodType === "quarterly" ? periodKey : quarterFallbackKey;
    return quarterPeriod ? previousDmReportTargetPeriod(quarterPeriod) : null;
  }, [needsPreviousQuarter, periodKey, quarterFallbackKey]);

  const baselineMetrics = useMemo(() => {
    const map = emptyChannelMetricsMap();
    for (const row of rowsMissingBaseline) {
      if (!map.meta.includes(row.metric_key)) map.meta.push(row.metric_key);
    }
    return map;
  }, [rowsMissingBaseline]);
  const previousMonthActuals = useDmReportPeriodActuals(previousMonthKey, baselineMetrics);
  const previousQuarterActuals = useDmReportPeriodActuals(previousQuarterKey, baselineMetrics);
  const previousActualsByPeriod = useMemo(() => {
    const map = new Map<string, Map<string, DmAccountPeriodActuals>>();
    if (previousMonthKey) {
      map.set(dmTargetPeriodCacheKey(previousMonthKey), previousMonthActuals.actualsByAccount);
    }
    if (previousQuarterKey) {
      map.set(dmTargetPeriodCacheKey(previousQuarterKey), previousQuarterActuals.actualsByAccount);
    }
    return map;
  }, [
    previousMonthKey,
    previousQuarterKey,
    previousMonthActuals.actualsByAccount,
    previousQuarterActuals.actualsByAccount,
  ]);

  const metricDirections = useMemo(
    () =>
      normalizeMetricDirectionsForMetrics(
        selectedReportMetrics,
        parseMetricDirectionsFromSettings(periodSettingsQuery.data?.metric_directions),
      ),
    [selectedReportMetrics, periodSettingsQuery.data?.metric_directions],
  );

  const progressList = useMemo(
    () =>
      computeMetaAdsPageTargetProgress({
        summary: args.summary,
        rows: args.rows,
        adAccountId: args.adAccountId,
        dateSelection,
        targetRows,
        selectedTableMetricKeys: args.tableMetricKeys,
        metricDirections,
        previousActualsByPeriod,
      }),
    [
      args.summary,
      args.rows,
      args.adAccountId,
      dateSelection,
      targetRows,
      args.tableMetricKeys,
      metricDirections,
      previousActualsByPeriod,
    ],
  );

  const progressByTableMetric = useMemo(
    () => metaTargetProgressByTableMetric(progressList, args.tableMetricKeys),
    [progressList, args.tableMetricKeys],
  );

  return {
    progressList,
    progressByTableMetric,
    targetsLoading:
      targetsQuery.isLoading ||
      periodSettingsQuery.isLoading ||
      (quarterFallbackKey != null && quarterTargetsQuery.isLoading) ||
      (previousMonthKey != null && previousMonthActuals.isLoading) ||
      (previousQuarterKey != null && previousQuarterActuals.isLoading),
    selectedReportMetrics,
  };
}

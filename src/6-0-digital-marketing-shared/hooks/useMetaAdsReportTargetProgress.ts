import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  normalizeMetricDirectionsForMetrics,
  parseMetricDirectionsFromSettings,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { isReportMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import {
  periodKeyFromResolved,
  resolveDmReportTargetPeriod,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import type { DmReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { useDmReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodSettingsQuery";
import { useDmReportTargetsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetsQuery";
import {
  computeMetaAdsPageTargetProgress,
  metaAdsTableMetricKeyToReportSlotKey,
  metaTargetProgressByTableMetric,
} from "@/6-0-digital-marketing-shared/metaAdsPageTargetProgress";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsTableMetricKey } from "@/meta-ads/metrics/metaAdsSummaryMetrics";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

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
  const periodSettingsQuery = useDmReportPeriodSettingsQuery(periodKey);

  const selectedReportMetrics = useMemo(() => {
    const fromSettings = periodSettingsQuery.data?.selected_metrics_by_channel?.meta ?? [];
    const fromCards = args.tableMetricKeys
      .map(metaAdsTableMetricKeyToReportSlotKey)
      .filter((key): key is ReportTableMetricKey => key != null);
    const fromTargets = (targetsQuery.data ?? [])
      .filter(
        (row) =>
          row.channel === "meta" &&
          (!args.adAccountId || row.account_id === args.adAccountId) &&
          isReportMetricKey(row.metric_key),
      )
      .map((row) => row.metric_key as ReportTableMetricKey);
    return [...new Set([...fromSettings, ...fromCards, ...fromTargets])];
  }, [
    periodSettingsQuery.data?.selected_metrics_by_channel?.meta,
    args.tableMetricKeys,
    targetsQuery.data,
    args.adAccountId,
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
        targetRows: targetsQuery.data ?? [],
        selectedTableMetricKeys: args.tableMetricKeys,
        metricDirections,
      }),
    [
      args.summary,
      args.rows,
      args.adAccountId,
      dateSelection,
      targetsQuery.data,
      args.tableMetricKeys,
      metricDirections,
    ],
  );

  const progressByTableMetric = useMemo(
    () => metaTargetProgressByTableMetric(progressList, args.tableMetricKeys),
    [progressList, args.tableMetricKeys],
  );

  return {
    progressList,
    progressByTableMetric,
    targetsLoading: targetsQuery.isLoading || periodSettingsQuery.isLoading,
    selectedReportMetrics,
  };
}

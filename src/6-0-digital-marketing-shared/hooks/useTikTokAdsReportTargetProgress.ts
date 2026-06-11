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
  computeTikTokAdsPageTargetProgress,
  tiktokAdsTableMetricKeyToReportSlotKey,
  tiktokTargetProgressByTableMetric,
} from "@/6-0-digital-marketing-shared/tiktokAdsPageTargetProgress";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsTableMetricKey } from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";

export function useTikTokAdsReportTargetProgress(args: {
  advertiserId: string | null;
  summary: { spend: number; impressions: number; clicks: number; currency: string } | null | undefined;
  rows: TikTokAdsMetricsRow[];
  tableMetricKeys: TikTokAdsTableMetricKey[];
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
    const fromSettings = periodSettingsQuery.data?.selected_metrics_by_channel?.tiktok ?? [];
    const fromCards = args.tableMetricKeys
      .map(tiktokAdsTableMetricKeyToReportSlotKey)
      .filter((key): key is ReportTableMetricKey => key != null);
    const fromTargets = (targetsQuery.data ?? [])
      .filter(
        (row) =>
          row.channel === "tiktok" &&
          (!args.advertiserId || row.account_id === args.advertiserId) &&
          isReportMetricKey(row.metric_key),
      )
      .map((row) => row.metric_key as ReportTableMetricKey);
    return [...new Set([...fromSettings, ...fromCards, ...fromTargets])];
  }, [
    periodSettingsQuery.data?.selected_metrics_by_channel?.tiktok,
    args.tableMetricKeys,
    targetsQuery.data,
    args.advertiserId,
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
      computeTikTokAdsPageTargetProgress({
        summary: args.summary,
        rows: args.rows,
        advertiserId: args.advertiserId,
        dateSelection,
        targetRows: targetsQuery.data ?? [],
        selectedTableMetricKeys: args.tableMetricKeys,
        metricDirections,
      }),
    [
      args.summary,
      args.rows,
      args.advertiserId,
      dateSelection,
      targetsQuery.data,
      args.tableMetricKeys,
      metricDirections,
    ],
  );

  const progressByTableMetric = useMemo(
    () => tiktokTargetProgressByTableMetric(progressList, args.tableMetricKeys),
    [progressList, args.tableMetricKeys],
  );

  return {
    progressList,
    progressByTableMetric,
    targetsLoading: targetsQuery.isLoading || periodSettingsQuery.isLoading,
    selectedReportMetrics,
  };
}

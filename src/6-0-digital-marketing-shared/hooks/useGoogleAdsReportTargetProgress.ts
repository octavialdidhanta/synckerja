import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  normalizeMetricDirectionsForMetrics,
  parseMetricDirectionsFromSettings,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { catalogKeyToReportSlotKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetMetricMapping";
import { computeGoogleAdsPageTargetProgress } from "@/6-0-digital-marketing-shared/googleAdsPageTargetProgress";
import { dmTargetProgressByMetric } from "@/6-0-digital-marketing-shared/dmReportTargetProgress";
import {
  periodKeyFromResolved,
  resolveDmReportTargetPeriod,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import type { DmReportTargetPeriodKey, DmReportTargetProgress } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import { isReportMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { useDmReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodSettingsQuery";
import { useDmReportTargetsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetsQuery";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import type { GoogleAdsMetricsSummaryTotals } from "@/google-ads/metrics/types";

export function useGoogleAdsReportTargetProgress(args: {
  customerId: string | null;
  googleTotals: GoogleAdsMetricsSummaryTotals | null | undefined;
  catalogMetricKeys: string[];
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

  const selectedGoogleReportMetrics = useMemo(() => {
    const fromSettings = periodSettingsQuery.data?.selected_metrics_by_channel?.google ?? [];
    const fromCards = args.catalogMetricKeys
      .map(catalogKeyToReportSlotKey)
      .filter((key): key is ReportTableMetricKey => key != null);
    const fromTargets = (targetsQuery.data ?? [])
      .filter(
        (row) =>
          row.channel === "google" &&
          (!args.customerId || row.account_id === args.customerId) &&
          isReportMetricKey(row.metric_key),
      )
      .map((row) => row.metric_key as ReportTableMetricKey);
    return [...new Set([...fromSettings, ...fromCards, ...fromTargets])];
  }, [
    periodSettingsQuery.data?.selected_metrics_by_channel?.google,
    args.catalogMetricKeys,
    targetsQuery.data,
    args.customerId,
  ]);

  const metricDirections = useMemo(
    () =>
      normalizeMetricDirectionsForMetrics(
        selectedGoogleReportMetrics,
        parseMetricDirectionsFromSettings(periodSettingsQuery.data?.metric_directions),
      ),
    [selectedGoogleReportMetrics, periodSettingsQuery.data?.metric_directions],
  );

  const progressList = useMemo(
    () =>
      computeGoogleAdsPageTargetProgress({
        totals: args.googleTotals,
        customerId: args.customerId,
        dateSelection,
        targetRows: targetsQuery.data ?? [],
        selectedReportMetricKeys: selectedGoogleReportMetrics,
        metricDirections,
      }),
    [
      args.googleTotals,
      args.customerId,
      dateSelection,
      targetsQuery.data,
      selectedGoogleReportMetrics,
      metricDirections,
    ],
  );

  const progressByReportMetric = useMemo(
    () => dmTargetProgressByMetric(progressList),
    [progressList],
  );

  const progressByCatalogKey = useMemo(() => {
    const map = new Map<string, DmReportTargetProgress>();
    for (const catalogKey of args.catalogMetricKeys) {
      const reportKey = catalogKeyToReportSlotKey(catalogKey);
      if (!reportKey) continue;
      const progress = progressByReportMetric.get(reportKey);
      if (progress) map.set(catalogKey, progress);
    }
    const costProgress = progressByReportMetric.get("cost");
    if (costProgress) map.set("spent", costProgress);
    return map;
  }, [args.catalogMetricKeys, progressByReportMetric]);

  return {
    progressList,
    progressByCatalogKey,
    progressByReportMetric,
    targetsLoading:
      periodKey != null && (targetsQuery.isLoading || periodSettingsQuery.isLoading),
    periodKey,
    resolvedPeriod,
    selectedGoogleReportMetrics,
  };
}

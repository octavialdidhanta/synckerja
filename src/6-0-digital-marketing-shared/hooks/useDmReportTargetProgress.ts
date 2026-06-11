import { useMemo } from "react";
import { useDigitalMarketingPaidAdsFilters } from "@/6-0-digital-marketing-shared/DigitalMarketingPaidAdsFiltersContext";
import {
  normalizeMetricDirectionsForMetrics,
  parseMetricDirectionsFromSettings,
} from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import {
  computeDmReportTargetProgress,
  dmTargetProgressByReportSlot,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgress";
import {
  periodKeyFromResolved,
  resolveDmReportTargetPeriod,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  dmTargetAccountKey,
  type DmReportMetricValueKind,
  type DmReportTargetPeriodKey,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import {
  buildChannelMetricsMapForActuals,
  unionChannelMetrics,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricsByChannel";
import { useDmReportPeriodSettingsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodSettingsQuery";
import { useDmReportTargetsQuery } from "@/6-0-digital-marketing-shared/hooks/useDmReportTargetsQuery";
import { useDmReportPeriodActuals } from "@/6-0-digital-marketing-shared/hooks/useDmReportPeriodActuals";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

export function useDmReportTargetProgress(args: {
  googleCustomerId: string | null;
  metaAdAccountId: string | null;
  tiktokAdvertiserId: string | null;
  selectedReportMetrics: ReportTableMetricKey[];
  valueKinds: Record<string, DmReportMetricValueKind>;
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

  const selectedMetricsByChannel = useMemo(
    () =>
      periodSettingsQuery.data?.selected_metrics_by_channel ?? {
        google: [],
        meta: [],
        tiktok: [],
      },
    [periodSettingsQuery.data?.selected_metrics_by_channel],
  );

  const selectedMetricKeys = useMemo(() => {
    const fromSettings = unionChannelMetrics(selectedMetricsByChannel);
    const fromTargets = [
      ...new Set((targetsQuery.data ?? []).map((row) => row.metric_key)),
    ];
    return [
      ...new Set([...fromSettings, ...args.selectedReportMetrics, ...fromTargets]),
    ];
  }, [selectedMetricsByChannel, args.selectedReportMetrics, targetsQuery.data]);

  const metricsByChannelForActuals = useMemo(
    () =>
      buildChannelMetricsMapForActuals(
        selectedMetricsByChannel,
        selectedMetricKeys,
        targetsQuery.data ?? [],
      ),
    [selectedMetricsByChannel, selectedMetricKeys, targetsQuery.data],
  );

  const { actualsByAccount } = useDmReportPeriodActuals(periodKey, metricsByChannelForActuals);

  const filterAccountKeys = useMemo(() => {
    const googleId = args.googleCustomerId?.trim() || null;
    const metaId = args.metaAdAccountId?.trim() || null;
    const tiktokId = args.tiktokAdvertiserId?.trim() || null;
    const keys = new Set<string>();
    if (googleId) keys.add(dmTargetAccountKey("google", googleId));
    if (metaId) keys.add(dmTargetAccountKey("meta", metaId));
    if (tiktokId) keys.add(dmTargetAccountKey("tiktok", tiktokId));
    return keys.size > 0 ? keys : null;
  }, [args.googleCustomerId, args.metaAdAccountId, args.tiktokAdvertiserId]);

  const metricDirections = useMemo(
    () =>
      normalizeMetricDirectionsForMetrics(
        selectedMetricKeys,
        parseMetricDirectionsFromSettings(periodSettingsQuery.data?.metric_directions),
      ),
    [selectedMetricKeys, periodSettingsQuery.data?.metric_directions],
  );

  const progressList = useMemo(
    () =>
      computeDmReportTargetProgress({
        accountActuals: actualsByAccount,
        dateSelection,
        targetRows: targetsQuery.data ?? [],
        selectedMetricKeys,
        valueKinds: args.valueKinds,
        filterAccountKeys,
        metricDirections,
      }),
    [
      actualsByAccount,
      dateSelection,
      targetsQuery.data,
      selectedMetricKeys,
      args.valueKinds,
      filterAccountKeys,
      metricDirections,
    ],
  );

  const progressByReportSlot = useMemo(
    () => dmTargetProgressByReportSlot(progressList, args.selectedReportMetrics),
    [progressList, args.selectedReportMetrics],
  );

  return {
    progressList,
    progressByReportSlot,
    targetsLoading: targetsQuery.isLoading || periodSettingsQuery.isLoading,
    selectedMetricKeys,
  };
}

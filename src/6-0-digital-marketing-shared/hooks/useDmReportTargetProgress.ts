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
import { mergeDmReportTargetRows, savedDmBaselineValue } from "@/6-0-digital-marketing-shared/dmReportTargetBaseline";
import {
  dmTargetPeriodCacheKey,
  periodKeyFromResolved,
  previousDmReportTargetPeriod,
  quarterlyPeriodContainingMonth,
  resolveDmReportTargetPeriod,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  dmTargetAccountKey,
  type DmAccountPeriodActuals,
  type DmReportMetricValueKind,
  type DmReportTargetPeriodKey,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import {
  buildChannelMetricsMapForActuals,
  emptyChannelMetricsMap,
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
  /** CTR on the summary card is a fraction; progress compares it to the percent target. */
  cardActualByMetric?: Partial<Record<string, number | null>>;
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
    const fromTargets = [...new Set(targetRows.map((row) => row.metric_key))];
    return [
      ...new Set([...fromSettings, ...args.selectedReportMetrics, ...fromTargets]),
    ];
  }, [selectedMetricsByChannel, args.selectedReportMetrics, targetRows]);

  const metricsByChannelForActuals = useMemo(
    () =>
      buildChannelMetricsMapForActuals(
        selectedMetricsByChannel,
        selectedMetricKeys,
        targetRows,
      ),
    [selectedMetricsByChannel, selectedMetricKeys, targetRows],
  );

  const { actualsByAccount } = useDmReportPeriodActuals(periodKey, metricsByChannelForActuals);

  const rowsMissingBaseline = useMemo(
    () => targetRows.filter((row) => savedDmBaselineValue(row) == null),
    [targetRows],
  );
  const needsPreviousMonth = rowsMissingBaseline.some((row) => row.period_type === "monthly");
  const needsPreviousQuarter = rowsMissingBaseline.some((row) => row.period_type === "quarterly");

  const baselineMetrics = useMemo(() => {
    const map = emptyChannelMetricsMap();
    for (const row of rowsMissingBaseline) {
      const list = map[row.channel];
      if (!list.includes(row.metric_key)) list.push(row.metric_key);
    }
    return map;
  }, [rowsMissingBaseline]);

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

  const cardCtr = args.cardActualByMetric?.ctr ?? null;

  const progressList = useMemo(
    () =>
      computeDmReportTargetProgress({
        accountActuals: actualsByAccount,
        dateSelection,
        targetRows,
        selectedMetricKeys,
        valueKinds: args.valueKinds,
        filterAccountKeys,
        metricDirections,
        cardActualByMetric: { ctr: cardCtr },
        previousActualsByPeriod,
      }),
    [
      actualsByAccount,
      dateSelection,
      targetRows,
      selectedMetricKeys,
      args.valueKinds,
      filterAccountKeys,
      metricDirections,
      cardCtr,
      previousActualsByPeriod,
    ],
  );

  const progressByReportSlot = useMemo(
    () => dmTargetProgressByReportSlot(progressList, args.selectedReportMetrics),
    [progressList, args.selectedReportMetrics],
  );

  return {
    progressList,
    progressByReportSlot,
    targetsLoading:
      targetsQuery.isLoading ||
      periodSettingsQuery.isLoading ||
      (quarterFallbackKey != null && quarterTargetsQuery.isLoading) ||
      (previousMonthKey != null && previousMonthActuals.isLoading) ||
      (previousQuarterKey != null && previousQuarterActuals.isLoading),
    selectedMetricKeys,
  };
}

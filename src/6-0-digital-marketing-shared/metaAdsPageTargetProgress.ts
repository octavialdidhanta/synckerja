import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import {
  computeDmReportBaselineGapPercentage,
  dmMetricBaselineOnTargetScale,
  dmTargetRowPeriodKey,
} from "@/6-0-digital-marketing-shared/dmReportTargetBaseline";
import { actualValueFromMetaTikTok, metaKpiActualFromSummary, type DmMetaPeriodSummary } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import { aggregateEfficiencyTargetValues } from "@/6-0-digital-marketing-shared/dmReportTargetMetricAggregate";
import {
  computeDmReportTargetDeviationPercentage,
  computeDmReportSummaryDisplayPercentage,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { reportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import {
  dmActualOnTargetScale,
  effectiveTargetForDmMetric,
  isEfficiencyMetricKey,
  isPercentageMetricKey,
  resolveDmReportTargetPeriod,
  resolvePeriodKeyToBounds,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import {
  dmTargetAccountKey,
  type DmAccountPeriodActuals,
  type DmReportTargetProgress,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import type { MetaAdsTableMetricKey } from "@/meta-ads/metrics/metaAdsSummaryMetrics";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";

const META_KPI_TABLE_KEYS = new Set<MetaAdsTableMetricKey>([
  "cpm",
  "view_to_atc_rate",
  "atc_to_purchase_rate",
  "aov",
]);

export function metaAdsTableMetricKeyToTargetMetricKey(key: MetaAdsTableMetricKey): string | null {
  return metaAdsTableMetricKeyToReportSlotKey(key) ?? (META_KPI_TABLE_KEYS.has(key) ? key : null);
}

export function metaAdsTableMetricKeyToReportSlotKey(
  key: MetaAdsTableMetricKey,
): ReportTableMetricKey | null {
  const map: Partial<Record<MetaAdsTableMetricKey, ReportTableMetricKey>> = {
    spend: "cost",
    impressions: "impressions",
    clicks: "clicks",
    ctr: "ctr",
    cpc: "cpc",
    service_cpl: "cpa",
    service_converted_leads: "converted_leads",
  };
  return map[key] ?? null;
}

function metaRowsForMetric(
  rows: DmReportTargetRow[],
  reportKey: string,
  adAccountId: string | null,
): DmReportTargetRow[] {
  return rows.filter((row) => {
    if (row.channel !== "meta" || row.metric_key !== reportKey) return false;
    if (adAccountId && row.account_id !== adAccountId) return false;
    const value = Number(row.target_value);
    return Number.isFinite(value) && value > 0;
  });
}

function rawTargetForRows(reportKey: string, rows: DmReportTargetRow[]): number {
  if (rows.length === 0) return 0;
  if (isEfficiencyMetricKey(reportKey)) {
    return (
      aggregateEfficiencyTargetValues(
        rows.map((row) => ({
          channel: row.channel,
          accountKey: dmTargetAccountKey(row.channel, row.account_id),
          value: Number(row.target_value),
        })),
      ) ?? 0
    );
  }
  return rows.reduce((sum, row) => sum + Number(row.target_value), 0);
}

export function computeMetaAdsPageTargetProgress(args: {
  summary: DmMetaPeriodSummary | null | undefined;
  rows: MetaAdsMetricsRow[];
  adAccountId: string | null;
  dateSelection: GoogleAdsDateRangeSelection;
  targetRows: DmReportTargetRow[];
  selectedTableMetricKeys: MetaAdsTableMetricKey[];
  metricDirections?: DmReportMetricDirectionsMap | null;
  previousActualsByPeriod?: ReadonlyMap<string, Map<string, DmAccountPeriodActuals>>;
}): DmReportTargetProgress[] {
  const resolvedPeriod = resolveDmReportTargetPeriod(args.dateSelection);
  if (!resolvedPeriod) return [];

  const viewBounds = resolvePeriodKeyToBounds({
    periodType: resolvedPeriod.periodType,
    year: resolvedPeriod.year,
    month: resolvedPeriod.month,
    quarter: resolvedPeriod.quarter,
  });

  const results: DmReportTargetProgress[] = [];

  for (const tableKey of args.selectedTableMetricKeys) {
    const reportKey = metaAdsTableMetricKeyToTargetMetricKey(tableKey);
    if (!reportKey) continue;

    const metricRows = metaRowsForMetric(args.targetRows, reportKey, args.adAccountId);
    const rawTarget = rawTargetForRows(reportKey, metricRows);
    const quarterRow = metricRows.find((row) => row.period_type === "quarterly");
    const quarterPeriod =
      quarterRow && metricRows.every((row) => row.period_type === "quarterly")
        ? dmTargetRowPeriodKey(quarterRow)
        : null;
    const bounds = quarterPeriod ? resolvePeriodKeyToBounds(quarterPeriod) : viewBounds;

    const effectiveTarget = effectiveTargetForDmMetric(rawTarget, reportKey, bounds);
    const rawActual = META_KPI_TABLE_KEYS.has(tableKey)
      ? metaKpiActualFromSummary(args.summary, reportKey)
      : actualValueFromMetaTikTok(args.summary, args.rows, reportKey as ReportTableMetricKey);
    const actual = isPercentageMetricKey(reportKey)
      ? dmActualOnTargetScale(reportKey, rawActual)
      : rawActual;
    const valueKind = reportMetricValueKind(reportKey);
    const baselineFull = dmMetricBaselineOnTargetScale({
      metricKey: reportKey,
      rows: metricRows,
      previousActualsByPeriod: args.previousActualsByPeriod ?? new Map(),
    });
    const baseline =
      baselineFull != null
        ? effectiveTargetForDmMetric(baselineFull, reportKey, bounds)
        : null;

    const showProgress = effectiveTarget > 0;
    const percentage =
      showProgress && actual != null
        ? baseline != null
          ? computeDmReportBaselineGapPercentage(actual, baseline, effectiveTarget)
          : computeDmReportSummaryDisplayPercentage(
              actual,
              effectiveTarget,
              reportKey,
              args.metricDirections,
            )
        : null;
    const deviationPercentage =
      showProgress && actual != null
        ? computeDmReportTargetDeviationPercentage(
            actual,
            effectiveTarget,
            reportKey,
            args.metricDirections,
          )
        : null;

    results.push({
      metricKey: reportKey,
      actual,
      target: showProgress ? effectiveTarget : null,
      targetRaw: rawTarget > 0 ? rawTarget : null,
      baseline,
      percentage,
      deviationPercentage,
      showProgress,
      valueKind,
    });
  }

  return results;
}

export function metaTargetProgressByTableMetric(
  list: DmReportTargetProgress[],
  selectedTableMetricKeys: MetaAdsTableMetricKey[],
): Map<MetaAdsTableMetricKey, DmReportTargetProgress> {
  const byReport = new Map(list.map((p) => [p.metricKey, p]));
  const map = new Map<MetaAdsTableMetricKey, DmReportTargetProgress>();
  for (const tableKey of selectedTableMetricKeys) {
    const reportKey = metaAdsTableMetricKeyToTargetMetricKey(tableKey);
    if (!reportKey) continue;
    const progress = byReport.get(reportKey);
    if (progress) map.set(tableKey, progress);
  }
  return map;
}

export function formatMetaAdsTargetProgressRatio(
  tableKey: MetaAdsTableMetricKey,
  progress: DmReportTargetProgress | undefined,
  currency: string,
): string | null {
  if (
    !progress?.showProgress ||
    progress.target == null ||
    progress.target <= 0 ||
    progress.actual == null
  ) {
    return null;
  }

  const fmt = (value: number) => {
    if (tableKey === "ctr") return `${value.toFixed(2)}%`;
    if (tableKey === "service_cpl") return formatMetaMetricValue("service_cpl", value, currency);
    if (tableKey === "service_converted_leads") {
      return formatMetaMetricValue("service_converted_leads", value, currency);
    }
    return formatMetaMetricValue(tableKey, value, currency);
  };

  const current = fmt(progress.actual);
  const target = fmt(progress.target);
  if (progress.baseline != null) {
    return `${fmt(progress.baseline)} → ${current} / ${target}`;
  }
  return `${current} / ${target}`;
}

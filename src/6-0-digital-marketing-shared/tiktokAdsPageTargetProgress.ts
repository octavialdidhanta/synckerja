import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { actualValueFromMetaTikTok } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import {
  computeDmReportTargetDeviationPercentage,
  computeDmReportSummaryDisplayPercentage,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { reportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import {
  effectiveTargetForDmMetric,
  resolveDmReportTargetPeriod,
  resolvePeriodKeyToBounds,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  dmTargetCellKey,
  type DmReportTargetProgress,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsTableMetricKey } from "@/tiktok-ads/metrics/tiktokAdsSummaryMetrics";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";

export function tiktokAdsTableMetricKeyToReportSlotKey(
  key: TikTokAdsTableMetricKey,
): ReportTableMetricKey | null {
  const map: Partial<Record<TikTokAdsTableMetricKey, ReportTableMetricKey>> = {
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

function tiktokTargetMapFromRows(rows: DmReportTargetRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.channel !== "tiktok") continue;
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(dmTargetCellKey(row.channel, row.account_id, row.metric_key), value);
  }
  return map;
}

export function computeTikTokAdsPageTargetProgress(args: {
  summary: { spend: number; impressions: number; clicks: number; currency: string } | null | undefined;
  rows: TikTokAdsMetricsRow[];
  advertiserId: string | null;
  dateSelection: GoogleAdsDateRangeSelection;
  targetRows: DmReportTargetRow[];
  selectedTableMetricKeys: TikTokAdsTableMetricKey[];
  metricDirections?: DmReportMetricDirectionsMap | null;
}): DmReportTargetProgress[] {
  const resolvedPeriod = resolveDmReportTargetPeriod(args.dateSelection);
  if (!resolvedPeriod) return [];

  const bounds = resolvePeriodKeyToBounds({
    periodType: resolvedPeriod.periodType,
    year: resolvedPeriod.year,
    month: resolvedPeriod.month,
    quarter: resolvedPeriod.quarter,
  });

  const targetMap = tiktokTargetMapFromRows(args.targetRows);
  const results: DmReportTargetProgress[] = [];

  for (const tableKey of args.selectedTableMetricKeys) {
    const reportKey = tiktokAdsTableMetricKeyToReportSlotKey(tableKey);
    if (!reportKey) continue;

    const rawTarget = args.advertiserId
      ? (targetMap.get(dmTargetCellKey("tiktok", args.advertiserId, reportKey)) ?? 0)
      : [...targetMap.entries()]
          .filter(([k]) => k.endsWith(`:${reportKey}`))
          .reduce((sum, [, v]) => sum + v, 0);

    const effectiveTarget = effectiveTargetForDmMetric(rawTarget, reportKey, bounds);
    const actual = actualValueFromMetaTikTok(args.summary, args.rows, reportKey);
    const valueKind = reportMetricValueKind(reportKey);

    const showProgress = effectiveTarget > 0;
    const percentage =
      showProgress && actual != null
        ? computeDmReportSummaryDisplayPercentage(
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
      percentage,
      deviationPercentage,
      showProgress,
      valueKind,
    });
  }

  return results;
}

export function tiktokTargetProgressByTableMetric(
  list: DmReportTargetProgress[],
  selectedTableMetricKeys: TikTokAdsTableMetricKey[],
): Map<TikTokAdsTableMetricKey, DmReportTargetProgress> {
  const byReport = new Map(list.map((p) => [p.metricKey, p]));
  const map = new Map<TikTokAdsTableMetricKey, DmReportTargetProgress>();
  for (const tableKey of selectedTableMetricKeys) {
    const reportKey = tiktokAdsTableMetricKeyToReportSlotKey(tableKey);
    if (!reportKey) continue;
    const progress = byReport.get(reportKey);
    if (progress) map.set(tableKey, progress);
  }
  return map;
}

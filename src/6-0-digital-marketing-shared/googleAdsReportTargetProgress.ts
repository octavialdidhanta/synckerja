import {
  computeDmReportTargetDeviationPercentage,
  computeDmReportSummaryDisplayPercentage,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { catalogKeyToReportSlotKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetMetricMapping";
import { actualValueFromTotals } from "@/6-0-digital-marketing-shared/googleAdsReportTargetActuals";
import {
  effectiveTargetForGoogleAdsMetric,
  resolveGoogleAdsReportTargetPeriod,
  resolvePeriodKeyToBounds,
} from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import type { GoogleAdsReportTargetProgress } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { GoogleAdsReportTargetRow } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { GoogleAdsMetricsSummaryTotals, MetricValueKind } from "@/google-ads/metrics/types";

function targetMapFromRows(rows: GoogleAdsReportTargetRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(`${row.google_customer_id}:${row.metric_key}`, value);
  }
  return map;
}

export function computeGoogleAdsReportTargetProgress(args: {
  totals: GoogleAdsMetricsSummaryTotals | null | undefined;
  customerId: string | null;
  dateSelection: GoogleAdsDateRangeSelection;
  targetRows: GoogleAdsReportTargetRow[];
  selectedMetricKeys: string[];
  valueKinds: Record<string, MetricValueKind>;
}): GoogleAdsReportTargetProgress[] {
  const resolvedPeriod = resolveGoogleAdsReportTargetPeriod(args.dateSelection);
  if (!resolvedPeriod) return [];

  const bounds = resolvePeriodKeyToBounds({
    periodType: resolvedPeriod.periodType,
    year: resolvedPeriod.year,
    month: resolvedPeriod.month,
    quarter: resolvedPeriod.quarter,
  });

  const targetMap = targetMapFromRows(args.targetRows);
  const results: GoogleAdsReportTargetProgress[] = [];

  for (const metricKey of args.selectedMetricKeys) {
    const rawTarget = args.customerId
      ? (targetMap.get(`${args.customerId}:${metricKey}`) ?? 0)
      : [...targetMap.entries()]
          .filter(([k]) => k.endsWith(`:${metricKey}`))
          .reduce((sum, [, v]) => sum + v, 0);

    const effectiveTarget = effectiveTargetForGoogleAdsMetric(rawTarget, metricKey, bounds);
    const actual = actualValueFromTotals(args.totals, metricKey);
    const valueKind = args.valueKinds[metricKey] ?? "count";

    const showProgress = effectiveTarget > 0;
    const reportSlotKey = catalogKeyToReportSlotKey(metricKey) ?? metricKey;
    const percentage =
      showProgress && actual != null
        ? computeDmReportSummaryDisplayPercentage(actual, effectiveTarget, reportSlotKey)
        : null;
    const deviationPercentage =
      showProgress && actual != null
        ? computeDmReportTargetDeviationPercentage(actual, effectiveTarget, reportSlotKey)
        : null;

    results.push({
      metricKey,
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

export function googleAdsTargetProgressByMetric(
  list: GoogleAdsReportTargetProgress[],
): Map<string, GoogleAdsReportTargetProgress> {
  return new Map(list.map((p) => [p.metricKey, p]));
}

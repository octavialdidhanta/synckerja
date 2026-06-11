import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import {
  computeDmReportTargetDeviationPercentage,
  computeDmReportSummaryDisplayPercentage,
} from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { actualValueFromGoogleTotals } from "@/6-0-digital-marketing-shared/dmReportTargetActuals";
import {
  effectiveTargetForDmMetric,
  resolveDmReportTargetPeriod,
  resolvePeriodKeyToBounds,
} from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import {
  isReportMetricKey,
  reportMetricValueKind,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import {
  dmTargetCellKey,
  type DmReportTargetProgress,
  type DmReportTargetRow,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { GoogleAdsMetricsSummaryTotals } from "@/google-ads/metrics/types";

function googleTargetMapFromRows(rows: DmReportTargetRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.channel !== "google") continue;
    const value = Number(row.target_value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(dmTargetCellKey(row.channel, row.account_id, row.metric_key), value);
  }
  return map;
}

export function computeGoogleAdsPageTargetProgress(args: {
  totals: GoogleAdsMetricsSummaryTotals | null | undefined;
  customerId: string | null;
  dateSelection: GoogleAdsDateRangeSelection;
  targetRows: DmReportTargetRow[];
  selectedReportMetricKeys: string[];
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

  const targetMap = googleTargetMapFromRows(args.targetRows);
  const results: DmReportTargetProgress[] = [];

  for (const metricKey of args.selectedReportMetricKeys) {
    if (!isReportMetricKey(metricKey)) continue;
    const reportKey = metricKey as ReportTableMetricKey;

    const rawTarget = args.customerId
      ? (targetMap.get(dmTargetCellKey("google", args.customerId, reportKey)) ?? 0)
      : [...targetMap.entries()]
          .filter(([k]) => k.endsWith(`:${reportKey}`))
          .reduce((sum, [, v]) => sum + v, 0);

    const effectiveTarget = effectiveTargetForDmMetric(rawTarget, reportKey, bounds);
    const actual = actualValueFromGoogleTotals(args.totals, reportKey);
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

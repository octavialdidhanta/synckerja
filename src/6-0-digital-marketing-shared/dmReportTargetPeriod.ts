import {
  countDaysInclusive,
  isPeriodInProgress,
  periodKeyToDateRangePayload,
  periodKeyToQueryFilter,
  prorateTargetValue,
  resolveInsightTargetPeriod,
  resolvePeriodKeyToBounds,
  type ResolvedInsightTargetPeriod,
} from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import type { DmReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

export {
  countDaysInclusive,
  isPeriodInProgress,
  periodKeyToDateRangePayload,
  periodKeyToQueryFilter,
  prorateTargetValue,
  resolvePeriodKeyToBounds,
  resolveInsightTargetPeriod as resolveDmReportTargetPeriod,
  type ResolvedInsightTargetPeriod,
};

/** Target input shows a % suffix (CTR only). */
export function isPercentageMetricKey(metricKey: string): boolean {
  return metricKey === "ctr";
}

/** CPC/CPA/CTR: weighted totals, not prorated by elapsed days. */
export function isEfficiencyMetricKey(metricKey: string): boolean {
  return metricKey === "ctr" || metricKey === "cpc" || metricKey === "cpa";
}

/** @deprecated Prefer isEfficiencyMetricKey or isPercentageMetricKey. */
export function isRateMetricKey(metricKey: string): boolean {
  return isEfficiencyMetricKey(metricKey);
}

export function effectiveTargetForDmMetric(
  rawTarget: number,
  metricKey: string,
  period: ResolvedInsightTargetPeriod | null,
  now: Date = new Date(),
): number {
  if (!period || rawTarget <= 0) return rawTarget;
  if (isEfficiencyMetricKey(metricKey)) return rawTarget;
  if (!isPeriodInProgress(period, now)) return rawTarget;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = countDaysInclusive(period.periodStart, period.periodEnd);
  const elapsedDays = countDaysInclusive(period.periodStart, today);
  return prorateTargetValue(rawTarget, elapsedDays, totalDays);
}

export function periodKeyFromResolved(period: ResolvedInsightTargetPeriod): DmReportTargetPeriodKey {
  if (period.periodType === "monthly") {
    return { periodType: "monthly", year: period.year, month: period.month };
  }
  return { periodType: "quarterly", year: period.year, quarter: period.quarter };
}

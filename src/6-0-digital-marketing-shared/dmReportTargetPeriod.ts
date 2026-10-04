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

/**
 * Report CTR actuals are click ÷ impression fractions (0.02 = 2%).
 * KPI targets are entered on the percent scale (2 = 2%).
 */
export function dmCtrFractionToPercent(fraction: number): number {
  return fraction * 100;
}

/** Actual on the same scale as the saved target (CTR percent, other metrics unchanged). */
export function dmActualOnTargetScale(metricKey: string, actual: number | null): number | null {
  if (actual == null || !Number.isFinite(actual)) return null;
  if (isPercentageMetricKey(metricKey)) return dmCtrFractionToPercent(actual);
  return actual;
}

/** CPC/CPA/CTR and Meta rate or average metrics: weighted totals, not prorated by elapsed days. */
export function isEfficiencyMetricKey(metricKey: string): boolean {
  return (
    metricKey === "ctr" ||
    metricKey === "cpc" ||
    metricKey === "cpa" ||
    metricKey === "cpm" ||
    metricKey === "view_to_atc_rate" ||
    metricKey === "atc_to_purchase_rate" ||
    metricKey === "aov"
  );
}

/** Target inputs that are typed as a percent. CTR actuals are still fractions; the other two are already percent. */
export function isPercentScaleMetricKey(metricKey: string): boolean {
  return (
    metricKey === "ctr" ||
    metricKey === "view_to_atc_rate" ||
    metricKey === "atc_to_purchase_rate"
  );
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

export function quarterContainingMonth(month: number): 1 | 2 | 3 | 4 {
  const quarter = Math.ceil(month / 3);
  if (quarter < 1) return 1;
  if (quarter > 4) return 4;
  return quarter as 1 | 2 | 3 | 4;
}

/** Q4 covers October–December, so a monthly October filter can use the Q4 target. */
export function quarterlyPeriodContainingMonth(
  year: number,
  month: number,
): DmReportTargetPeriodKey {
  return {
    periodType: "quarterly",
    year,
    quarter: quarterContainingMonth(month),
  };
}

export function previousDmReportTargetPeriod(
  period: DmReportTargetPeriodKey,
): DmReportTargetPeriodKey {
  if (period.periodType === "monthly") {
    const month = period.month ?? 1;
    if (month <= 1) return { periodType: "monthly", year: period.year - 1, month: 12 };
    return { periodType: "monthly", year: period.year, month: month - 1 };
  }
  const quarter = period.quarter ?? 1;
  if (quarter <= 1) return { periodType: "quarterly", year: period.year - 1, quarter: 4 };
  return {
    periodType: "quarterly",
    year: period.year,
    quarter: (quarter - 1) as 1 | 2 | 3 | 4,
  };
}

export function dmTargetPeriodCacheKey(period: DmReportTargetPeriodKey): string {
  if (period.periodType === "monthly") {
    return `monthly:${period.year}:${period.month ?? ""}`;
  }
  return `quarterly:${period.year}:${period.quarter ?? ""}`;
}

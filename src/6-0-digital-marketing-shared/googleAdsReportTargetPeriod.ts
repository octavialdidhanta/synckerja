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
import type { GoogleAdsReportTargetPeriodKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";

export {
  countDaysInclusive,
  isPeriodInProgress,
  periodKeyToDateRangePayload,
  periodKeyToQueryFilter,
  prorateTargetValue,
  resolvePeriodKeyToBounds,
  resolveInsightTargetPeriod as resolveGoogleAdsReportTargetPeriod,
  type ResolvedInsightTargetPeriod,
};

export function isRateMetricKey(metricKey: string): boolean {
  return (
    metricKey === "ctr" ||
    metricKey === "conv_rate" ||
    metricKey === "interaction_rate" ||
    metricKey.endsWith("_rate") ||
    metricKey.endsWith("_share") ||
    metricKey.endsWith("_pct") ||
    metricKey.endsWith("_percentage")
  );
}

export function effectiveTargetForGoogleAdsMetric(
  rawTarget: number,
  metricKey: string,
  period: ResolvedInsightTargetPeriod | null,
  now: Date = new Date(),
): number {
  if (!period || rawTarget <= 0) return rawTarget;
  if (isRateMetricKey(metricKey)) return rawTarget;
  if (!isPeriodInProgress(period, now)) return rawTarget;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = countDaysInclusive(period.periodStart, period.periodEnd);
  const elapsedDays = countDaysInclusive(period.periodStart, today);
  return prorateTargetValue(rawTarget, elapsedDays, totalDays);
}

export function periodKeyFromResolved(
  period: ResolvedInsightTargetPeriod,
): GoogleAdsReportTargetPeriodKey {
  if (period.periodType === "monthly") {
    return { periodType: "monthly", year: period.year, month: period.month };
  }
  return { periodType: "quarterly", year: period.year, quarter: period.quarter };
}

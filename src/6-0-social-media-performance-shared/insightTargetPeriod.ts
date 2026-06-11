import { endOfDay, endOfMonth, endOfQuarter, startOfDay, startOfMonth } from "date-fns";
import { toYmdLocal } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type { GoogleAdsDateRangeSelection } from "@/6-0-google-ads/lib/googleAdsDatePresets";
import type {
  InsightTargetPeriodKey,
  InsightTargetPeriodType,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

export type ResolvedInsightTargetPeriod = InsightTargetPeriodKey & {
  periodStart: Date;
  periodEnd: Date;
};

/** Map date picker selection to a monthly/quarterly target period, or null when progress is hidden. */
export function resolveInsightTargetPeriod(
  dateSelection: GoogleAdsDateRangeSelection,
  now: Date = new Date(),
): ResolvedInsightTargetPeriod | null {
  const { preset } = dateSelection;

  if (preset === "this_month" || preset === "last_month") {
    const from = dateSelection.range.from;
    if (!from) return null;
    const periodStart = startOfMonth(from);
    const periodEnd = endOfMonth(from);
    return {
      periodType: "monthly",
      year: from.getFullYear(),
      month: from.getMonth() + 1,
      periodStart,
      periodEnd,
    };
  }

  if (preset === "calendar_quarter") {
    const year = dateSelection.calendarYear;
    const quarter = dateSelection.calendarQuarter;
    if (year == null || quarter == null || quarter < 1 || quarter > 4) return null;
    const startMonth = (quarter - 1) * 3;
    const periodStart = startOfDay(new Date(year, startMonth, 1));
    const periodEnd = endOfQuarter(periodStart);
    return {
      periodType: "quarterly",
      year,
      quarter,
      periodStart,
      periodEnd,
    };
  }

  return null;
}

export function isPeriodInProgress(period: ResolvedInsightTargetPeriod, now: Date = new Date()): boolean {
  const today = startOfDay(now);
  const start = startOfDay(period.periodStart);
  const end = startOfDay(period.periodEnd);
  return today.getTime() >= start.getTime() && today.getTime() <= end.getTime();
}

export function countDaysInclusive(from: Date, to: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
}

export function prorateTargetValue(
  target: number,
  elapsedDays: number,
  totalDays: number,
): number {
  const t = Number(target);
  if (!Number.isFinite(t) || t <= 0) return 0;
  const total = Math.max(1, totalDays);
  const elapsed = Math.min(Math.max(1, elapsedDays), total);
  return Math.round((t * elapsed) / total);
}

export function effectiveTargetForMetric(
  rawTarget: number,
  metric: import("@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes").InsightTargetMetric,
  period: ResolvedInsightTargetPeriod | null,
  now: Date = new Date(),
): number {
  if (!period || rawTarget <= 0) return rawTarget;
  if (metric === "avg_engagement_rate") return rawTarget;
  if (!isPeriodInProgress(period, now)) return rawTarget;

  const today = startOfDay(now);
  const totalDays = countDaysInclusive(period.periodStart, period.periodEnd);
  const elapsedDays = countDaysInclusive(period.periodStart, today);
  return prorateTargetValue(rawTarget, elapsedDays, totalDays);
}

export function periodKeyToQueryFilter(period: InsightTargetPeriodKey): {
  period_type: InsightTargetPeriodType;
  year: number;
  month?: number;
  quarter?: number;
} {
  if (period.periodType === "monthly") {
    return {
      period_type: "monthly",
      year: period.year,
      month: period.month,
    };
  }
  return {
    period_type: "quarterly",
    year: period.year,
    quarter: period.quarter,
  };
}

/** End of period capped at today when period is in progress (for display only). */
export function periodEndForProgress(period: ResolvedInsightTargetPeriod, now: Date = new Date()): Date {
  if (isPeriodInProgress(period, now)) {
    return endOfDay(now);
  }
  return endOfDay(period.periodEnd);
}

/** Build calendar period bounds from settings form period key. */
export function resolvePeriodKeyToBounds(
  period: InsightTargetPeriodKey,
  now: Date = new Date(),
): ResolvedInsightTargetPeriod {
  if (period.periodType === "monthly" && period.month != null) {
    const periodStart = startOfMonth(new Date(period.year, period.month - 1, 1));
    const periodEnd = endOfMonth(periodStart);
    return {
      periodType: "monthly",
      year: period.year,
      month: period.month,
      periodStart,
      periodEnd,
    };
  }

  const quarter = period.quarter ?? 1;
  const startMonth = (quarter - 1) * 3;
  const periodStart = startOfDay(new Date(period.year, startMonth, 1));
  const periodEnd = endOfQuarter(periodStart);
  return {
    periodType: "quarterly",
    year: period.year,
    quarter,
    periodStart,
    periodEnd,
  };
}

/** API date range for fetching actuals in the selected target period. */
export function periodKeyToDateRangePayload(
  period: InsightTargetPeriodKey,
  now: Date = new Date(),
): { start: string; end: string; inProgress: boolean } {
  const bounds = resolvePeriodKeyToBounds(period, now);
  const inProgress = isPeriodInProgress(bounds, now);
  const effectiveEnd = inProgress ? endOfDay(now) : endOfDay(bounds.periodEnd);
  return {
    start: toYmdLocal(bounds.periodStart),
    end: toYmdLocal(effectiveEnd),
    inProgress,
  };
}

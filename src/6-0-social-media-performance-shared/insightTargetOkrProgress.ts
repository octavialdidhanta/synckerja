import {
  computeInsightBaselineGapPercentage,
  savedInsightBaselineValue,
} from "@/6-0-social-media-performance-shared/insightTargetBaseline";
import {
  effectiveTargetForMetric,
  resolvePeriodKeyToBounds,
} from "@/6-0-social-media-performance-shared/insightTargetPeriod";
import { actualValueForMetric, type PlatformPeriodActuals } from "@/6-0-social-media-performance-shared/insightTargetPlatformActuals";
import { computeProgressAgainstMonthlyTarget } from "@/6-1-dashboard/utils/performanceEmployeeMetrics";
import type {
  InsightTargetMetric,
  InsightTargetPeriodKey,
  SocialMediaInsightTargetRow,
} from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

export function insightKeyResultProgress(
  metric: InsightTargetMetric,
  actual: number | null,
  target: number,
  baseline?: number | null,
): number {
  if (target <= 0 || actual == null) return 0;
  if (baseline != null && Number.isFinite(baseline) && baseline > 0) {
    return computeInsightBaselineGapPercentage(actual, baseline, target);
  }
  return computeProgressAgainstMonthlyTarget(actual, target);
}

/** Gap progress when a baseline exists. Without one, keep the absolute actual/target ratio. */
export function insightObjectiveProgressPercentage(args: {
  row: Pick<SocialMediaInsightTargetRow, "metric" | "baseline_value" | "platform" | "account_id">;
  actual: number | null;
  targetRaw: number;
  period: InsightTargetPeriodKey;
  previousActuals?: Map<string, PlatformPeriodActuals> | null;
  now?: Date;
}): number {
  const saved = savedInsightBaselineValue(args.row);
  const previous = args.previousActuals?.get(`${args.row.platform}:${args.row.account_id}`);
  const previousActual = previous ? actualValueForMetric(previous, args.row.metric) : null;
  const baselineFull =
    saved ??
    (previousActual != null && previousActual > 0 ? previousActual : null);

  if (baselineFull == null) {
    return insightKeyResultProgress(args.row.metric, args.actual, args.targetRaw);
  }

  const now = args.now ?? new Date();
  const bounds = resolvePeriodKeyToBounds(args.period, now);
  const target = effectiveTargetForMetric(args.targetRaw, args.row.metric, bounds, now);
  const baseline = effectiveTargetForMetric(baselineFull, args.row.metric, bounds, now);
  return insightKeyResultProgress(args.row.metric, args.actual, target, baseline);
}

export function insightKeyResultMetricType(
  metric: InsightTargetMetric,
): "number" | "percentage" {
  return metric === "avg_engagement_rate" ? "percentage" : "number";
}

export function insightKeyResultUnit(metric: InsightTargetMetric): string {
  return metric === "avg_engagement_rate" ? "%" : "";
}

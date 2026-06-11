import { computeProgressAgainstMonthlyTarget } from "@/6-1-dashboard/utils/performanceEmployeeMetrics";
import type { InsightTargetMetric } from "@/6-0-social-media-performance-shared/socialMediaInsightTargetTypes";

export function insightKeyResultProgress(
  metric: InsightTargetMetric,
  actual: number | null,
  target: number,
): number {
  if (target <= 0 || actual == null) return 0;
  return computeProgressAgainstMonthlyTarget(actual, target);
}

export function insightKeyResultMetricType(
  metric: InsightTargetMetric,
): "number" | "percentage" {
  return metric === "avg_engagement_rate" ? "percentage" : "number";
}

export function insightKeyResultUnit(metric: InsightTargetMetric): string {
  return metric === "avg_engagement_rate" ? "%" : "";
}

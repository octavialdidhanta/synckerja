import { computeDmReportTargetOkrPercentage } from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { catalogKeyToReportSlotKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetMetricMapping";
import { isRateMetricKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetPeriod";
import type { MetricValueKind } from "@/google-ads/metrics/types";

export function googleAdsKeyResultProgress(
  metricKey: string,
  valueKind: MetricValueKind,
  actual: number | null,
  target: number,
): number {
  if (target <= 0 || actual == null) return 0;
  return computeDmReportTargetOkrPercentage(
    actual,
    target,
    catalogKeyToReportSlotKey(metricKey) ?? metricKey,
  );
}

export function googleAdsKeyResultMetricType(
  metricKey: string,
  valueKind: MetricValueKind,
): "number" | "percentage" {
  if (isRateMetricKey(metricKey) || valueKind === "rate" || valueKind === "fraction") {
    return "percentage";
  }
  return "number";
}

export function googleAdsKeyResultUnit(
  metricKey: string,
  valueKind: MetricValueKind,
): string {
  if (isRateMetricKey(metricKey) || valueKind === "rate" || valueKind === "fraction") {
    return "%";
  }
  if (valueKind === "micros") return "";
  return "";
}

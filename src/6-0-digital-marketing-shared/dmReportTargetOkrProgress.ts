import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { computeDmReportTargetOkrPercentage } from "@/6-0-digital-marketing-shared/dmReportTargetProgressMath";
import { isPercentageMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";
import type { DmReportMetricValueKind } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

export function dmKeyResultProgress(
  metricKey: string,
  valueKind: DmReportMetricValueKind,
  actual: number | null,
  target: number,
  directions?: DmReportMetricDirectionsMap | null,
): number {
  if (target <= 0 || actual == null) return 0;
  return computeDmReportTargetOkrPercentage(actual, target, metricKey, directions);
}

export function dmKeyResultMetricType(
  metricKey: string,
  valueKind: DmReportMetricValueKind,
): "number" | "percentage" {
  if (isPercentageMetricKey(metricKey) || valueKind === "rate") {
    return "percentage";
  }
  return "number";
}

export function dmKeyResultUnit(metricKey: string, valueKind: DmReportMetricValueKind): string {
  if (isPercentageMetricKey(metricKey) || valueKind === "rate") {
    return "%";
  }
  return "";
}

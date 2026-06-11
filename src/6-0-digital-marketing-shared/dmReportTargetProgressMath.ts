import { resolveDmReportMetricDirection } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import type { DmReportMetricDirectionsMap } from "@/6-0-digital-marketing-shared/dmReportMetricDirections";
import { normalizeMonthlyTargetValue } from "@/6-1-dashboard/utils/performanceEmployeeMetrics";
import { catalogKeyToReportSlotKey } from "@/6-0-digital-marketing-shared/googleAdsReportTargetMetricMapping";
import { isReportMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

export type DmReportTargetDirection = "higher_is_better" | "lower_is_better";

export function dmReportMetricDirection(
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): DmReportTargetDirection {
  return resolveDmReportMetricDirection(metricKey, directions);
}

function resolveReportMetricKey(metricKey: string): ReportTableMetricKey | null {
  if (isReportMetricKey(metricKey)) return metricKey;
  return catalogKeyToReportSlotKey(metricKey);
}

/** Progress bar fill: budget used % for lower-is-better (may exceed 100); achievement % for higher-is-better. */
export function computeDmReportTargetProgressPercentage(
  actual: number,
  target: number,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): number {
  const normalizedTarget = normalizeMonthlyTargetValue(target);
  if (normalizedTarget <= 0) return 0;

  const utilization = Math.round((actual / normalizedTarget) * 100);

  if (dmReportMetricDirection(metricKey, directions) === "lower_is_better") {
    return Math.max(0, utilization);
  }

  return Math.min(utilization, 100);
}

/** OKR / key-result score: 100% when on track, reduced when over cap or under goal. */
export function computeDmReportTargetOkrPercentage(
  actual: number,
  target: number,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): number {
  const normalizedTarget = normalizeMonthlyTargetValue(target);
  if (normalizedTarget <= 0) return 0;

  if (dmReportMetricDirection(metricKey, directions) === "lower_is_better") {
    if (actual <= normalizedTarget) return 100;
    return Math.min(100, Math.round((normalizedTarget / actual) * 100));
  }

  return Math.min(Math.round((actual / normalizedTarget) * 100), 100);
}

/**
 * Report summary card bar (single progress bar, not split):
 * Desc → OKR score (100% when at/under cap, below 100% when over, e.g. 95% for 23.619/22.500).
 * Asc → uncapped achievement (e.g. 105% for 23.619/22.500).
 */
export function computeDmReportSummaryDisplayPercentage(
  actual: number,
  target: number,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): number {
  const normalizedTarget = normalizeMonthlyTargetValue(target);
  if (normalizedTarget <= 0) return 0;

  if (dmReportMetricDirection(metricKey, directions) === "lower_is_better") {
    return computeDmReportTargetOkrPercentage(actual, target, metricKey, directions);
  }

  return Math.round((actual / normalizedTarget) * 100);
}

/** OKR deviation bar: 0% = on target; positive = favorable; negative = off-track. */
export function computeDmReportTargetDeviationPercentage(
  actual: number,
  target: number,
  metricKey: string,
  directions?: DmReportMetricDirectionsMap | null,
): number {
  const normalizedTarget = normalizeMonthlyTargetValue(target);
  if (normalizedTarget <= 0) return 0;

  if (dmReportMetricDirection(metricKey, directions) === "lower_is_better") {
    return Math.round(((normalizedTarget - actual) / normalizedTarget) * 100);
  }

  return Math.round(((actual - normalizedTarget) / normalizedTarget) * 100);
}

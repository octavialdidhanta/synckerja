import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import type { GoogleAdsMetricsSummaryTotals, MetricValueKind } from "@/google-ads/metrics/types";
import type { GoogleAdsAccountPeriodActuals } from "@/6-0-digital-marketing-shared/googleAdsReportTargetTypes";

export function actualValueFromTotals(
  totals: GoogleAdsMetricsSummaryTotals | null | undefined,
  metricKey: string,
): number | null {
  if (!totals) return null;
  if (totals.by_key && metricKey in totals.by_key) {
    const v = totals.by_key[metricKey];
    return v != null && Number.isFinite(v) ? v : null;
  }
  if (metricKey === "spent") return totals.spent ?? null;
  if (metricKey === "impressions") return totals.impressions ?? null;
  if (metricKey === "clicks") return totals.clicks ?? null;
  if (metricKey === "ctr") return totals.ctr ?? null;
  if (metricKey === "conversions") return totals.conversions ?? null;
  return null;
}

export function buildAccountActuals(
  customerId: string,
  totals: GoogleAdsMetricsSummaryTotals | null | undefined,
  selectedMetricKeys: string[],
  valueKinds: Record<string, MetricValueKind>,
  connected: boolean,
): GoogleAdsAccountPeriodActuals {
  const metrics: Record<string, number | null> = {};
  for (const key of selectedMetricKeys) {
    metrics[key] = actualValueFromTotals(totals, key);
  }
  return {
    customerId,
    hasConnectedAccount: connected,
    metrics,
    valueKinds,
  };
}

export function formatGoogleAdsActualValue(
  metricKey: string,
  value: number | null | undefined,
  currencyCode: string | null | undefined,
  valueKind?: MetricValueKind,
): string {
  return formatMetricValue(metricKey, value, currencyCode, valueKind);
}

export function actualValueForAccount(
  actuals: GoogleAdsAccountPeriodActuals,
  metricKey: string,
): number | null {
  return actuals.metrics[metricKey] ?? null;
}

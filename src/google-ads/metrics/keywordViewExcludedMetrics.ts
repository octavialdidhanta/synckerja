import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

/** Same set as backend `KEYWORD_VIEW_EXCLUDED_METRIC_KEYS` — not in keyword_view GAQL. */
export const KEYWORD_VIEW_EXCLUDED_METRIC_KEYS = new Set<string>([
  "invalid_clicks",
  "invalid_click_rate",
  "avg_cpv",
]);

export function filterUnsupportedMetricsForEntity(
  entity: GoogleAdsMetricEntity,
  keys: string[] | null | undefined,
): string[] {
  if (!keys?.length) return [];
  if (entity !== "keyword") return keys;
  return keys.filter((k) => !KEYWORD_VIEW_EXCLUDED_METRIC_KEYS.has(k));
}

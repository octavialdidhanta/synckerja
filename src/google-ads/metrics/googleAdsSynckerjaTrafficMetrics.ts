/** Synckerja-enriched Google Ads metrics (campaign entity, traffic UTM join). */

export const TRAFFIC_TOTAL_VISIT_PAGE_KEY = "traffic_total_visit_page";
export const TRAFFIC_VISIT_CLICK_RATE_KEY = "traffic_visit_click_rate";

export const SYNCKERJA_TRAFFIC_METRIC_KEYS = new Set<string>([
  TRAFFIC_TOTAL_VISIT_PAGE_KEY,
  TRAFFIC_VISIT_CLICK_RATE_KEY,
]);

export function isSynckerjaTrafficMetricKey(key: string): boolean {
  return SYNCKERJA_TRAFFIC_METRIC_KEYS.has(String(key ?? "").trim());
}

export const SYNCKERJA_TRAFFIC_METRIC_ITEMS = [
  {
    key: TRAFFIC_TOTAL_VISIT_PAGE_KEY,
    label: "Total Visit Page",
    description:
      "Unique sessions from Traffic where utm_campaign matches this campaign name (org default web_id, same date range).",
    entities: ["campaign"] as const,
    valueKind: "count" as const,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: TRAFFIC_VISIT_CLICK_RATE_KEY,
    label: "Visit / Click %",
    description: "Total Visit Page ÷ Clicks × 100 for this campaign.",
    entities: ["campaign"] as const,
    valueKind: "rate" as const,
    defaultSelected: false,
    sortable: true,
  },
];

/** Synckerja-enriched Google Ads metrics (campaign entity, leads UTM join). */

export const LEADS_TOTAL_KEY = "leads_total";
export const LEADS_VISIT_RATE_KEY = "leads_visit_rate";
export const LEADS_COST_PER_LEAD_KEY = "leads_cost_per_lead";

export const SYNCKERJA_LEADS_METRIC_KEYS = new Set<string>([
  LEADS_TOTAL_KEY,
  LEADS_VISIT_RATE_KEY,
  LEADS_COST_PER_LEAD_KEY,
]);

export function isSynckerjaLeadsMetricKey(key: string): boolean {
  return SYNCKERJA_LEADS_METRIC_KEYS.has(String(key ?? "").trim());
}

export const SYNCKERJA_LEADS_METRIC_ITEMS = [
  {
    key: LEADS_TOTAL_KEY,
    label: "Total Leads",
    description:
      "All leads from /omnichannel/leads (created_at in date range) where utm_campaign exactly matches this campaign name.",
    entities: ["campaign"] as const,
    valueKind: "count" as const,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: LEADS_VISIT_RATE_KEY,
    label: "Leads / Visit %",
    description: "Total Leads ÷ Total Visit Page × 100 for this campaign.",
    entities: ["campaign"] as const,
    valueKind: "rate" as const,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: LEADS_COST_PER_LEAD_KEY,
    label: "Cost / Leads",
    description: "Campaign spent ÷ Total Leads for this campaign.",
    entities: ["campaign"] as const,
    valueKind: "micros" as const,
    defaultSelected: false,
    sortable: true,
  },
];

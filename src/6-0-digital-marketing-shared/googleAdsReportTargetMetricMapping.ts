import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

const REPORT_TO_CATALOG: Record<ReportTableMetricKey, string> = {
  cost: "spent",
  cpc: "avg_cpc",
  cpa: "cost_per_conv",
  converted_leads: "conversions",
  impressions: "impressions",
  ctr: "ctr",
  clicks: "clicks",
};

export function reportSlotKeyToCatalogKey(slotKey: ReportTableMetricKey): string {
  return REPORT_TO_CATALOG[slotKey];
}

export function catalogKeyToReportSlotKey(catalogKey: string): ReportTableMetricKey | null {
  for (const [slot, catalog] of Object.entries(REPORT_TO_CATALOG)) {
    if (catalog === catalogKey) return slot as ReportTableMetricKey;
  }
  return null;
}

import type { DmReportChannel } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";

/** Google Ads API metric keys used when fetching summary_totals. */
const GOOGLE_API_KEYS: Record<ReportTableMetricKey, string> = {
  cost: "spent",
  cpc: "avg_cpc",
  cpa: "cost_per_conv",
  converted_leads: "conversions",
  impressions: "impressions",
  ctr: "ctr",
  clicks: "clicks",
};

/** Meta/TikTok: summary fields + campaign row keys for attribution metrics. */
const META_TIKTOK_SUMMARY_KEYS: ReportTableMetricKey[] = [
  "cost",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpa",
  "converted_leads",
];

export function reportMetricToGoogleApiKey(reportKey: ReportTableMetricKey): string {
  return GOOGLE_API_KEYS[reportKey];
}

const EFFICIENCY_METRIC_DEPENDENCIES: Partial<
  Record<ReportTableMetricKey, ReportTableMetricKey[]>
> = {
  cpc: ["cost", "clicks"],
  cpa: ["cost", "converted_leads"],
  ctr: ["clicks", "impressions"],
};

/** Include base metrics required to blend CPC/CPA/CTR across accounts. */
export function expandReportMetricsWithDependencies(keys: string[]): string[] {
  const result = new Set<string>();
  for (const key of keys) {
    result.add(key);
    if (!isReportMetricKey(key)) continue;
    for (const dep of EFFICIENCY_METRIC_DEPENDENCIES[key] ?? []) {
      result.add(dep);
    }
  }
  return [...result];
}

export function googleApiKeysForReportMetrics(keys: string[]): string[] {
  const expanded = expandReportMetricsWithDependencies(keys);
  const result: string[] = [];
  for (const key of expanded) {
    const apiKey = GOOGLE_API_KEYS[key as ReportTableMetricKey];
    if (apiKey && !result.includes(apiKey)) result.push(apiKey);
  }
  return result.length > 0 ? result : ["spent"];
}

export function isReportMetricKey(key: string): key is ReportTableMetricKey {
  return key in GOOGLE_API_KEYS;
}

export function reportMetricValueKind(key: ReportTableMetricKey): import("@/6-0-digital-marketing-shared/dmReportTargetTypes").DmReportMetricValueKind {
  switch (key) {
    case "cost":
    case "cpc":
    case "cpa":
      return "currency";
    case "ctr":
      return "rate";
    default:
      return "count";
  }
}

export function buildReportMetricLabels(
  t: (key: string, fallback: string) => string,
): Record<ReportTableMetricKey, string> {
  return {
    cost: t("digitalMarketing.report.tableCost", "Cost"),
    cpc: t("digitalMarketing.report.tableCpc", "CPC"),
    cpa: t("digitalMarketing.report.tableCostPerLead", "CPA"),
    converted_leads: t("digitalMarketing.report.tableConvertedLeads", "Conv. leads"),
    impressions: t("digitalMarketing.report.tableImpressions", "Impressions"),
    ctr: t("digitalMarketing.report.tableCtr", "CTR"),
    clicks: t("digitalMarketing.report.tableClicks", "Clicks"),
  };
}

export function channelLabel(
  channel: DmReportChannel,
  t: (key: string, fallback: string) => string,
): string {
  switch (channel) {
    case "google":
      return t("digitalMarketing.report.channelGoogle", "Google Ads");
    case "meta":
      return t("digitalMarketing.report.channelMeta", "Meta Ads");
    case "tiktok":
      return t("digitalMarketing.report.channelTikTok", "TikTok Ads");
  }
}

export function metaTikTokNeedsCampaignRows(selectedMetrics: string[]): boolean {
  return selectedMetrics.some(
    (k) => k === "converted_leads" || k === "cpa",
  );
}

export { META_TIKTOK_SUMMARY_KEYS };

import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export type GoogleAdsIdentityColumnDef = {
  key: string;
  label: string;
};

export const GOOGLE_ADS_PINNED_METRIC_KEYS = ["spent"] as const;

export function isGoogleAdsPinnedMetricKey(key: string): boolean {
  return (GOOGLE_ADS_PINNED_METRIC_KEYS as readonly string[]).includes(String(key ?? "").trim());
}

export function stripGoogleAdsPinnedMetricKeys(keys: string[]): string[] {
  return keys.filter((k) => !isGoogleAdsPinnedMetricKey(k));
}

/** Always visible — not in Modify columns picker. Cost is pinned next to Name. */
export const GOOGLE_ADS_IDENTITY_COLUMNS: Record<
  GoogleAdsMetricEntity,
  GoogleAdsIdentityColumnDef[]
> = {
  keyword: [
    { key: "keyword", label: "Keyword" },
    { key: "spent", label: "Cost" },
    { key: "match_type", label: "Match type" },
    { key: "campaign", label: "Campaign" },
    { key: "ad_group", label: "Ad group" },
  ],
  campaign: [
    { key: "service", label: "Service" },
    { key: "service_cpl", label: "CPA" },
    { key: "service_converted_leads", label: "Conv. leads" },
    { key: "name", label: "Campaign" },
    { key: "spent", label: "Cost" },
  ],
  ad_group: [
    { key: "name", label: "Ad group" },
    { key: "spent", label: "Cost" },
    { key: "campaign", label: "Campaign" },
  ],
  ad: [
    { key: "preview", label: "Ad" },
    { key: "spent", label: "Cost" },
  ],
};

/** Optional table columns — user can add/remove/reorder in Modify columns. */
export const GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS: Record<
  GoogleAdsMetricEntity,
  GoogleAdsIdentityColumnDef[]
> = {
  keyword: [{ key: "status", label: "Status" }],
  campaign: [
    { key: "status", label: "Status" },
    { key: "channel", label: "Type" },
  ],
  ad_group: [{ key: "status", label: "Status" }],
  ad: [{ key: "status", label: "Status" }],
};

export function optionalIdentityKeysForEntity(entity: GoogleAdsMetricEntity): Set<string> {
  return new Set(GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS[entity].map((c) => c.key));
}

export function isOptionalIdentityColumnKey(
  entity: GoogleAdsMetricEntity,
  key: string,
): boolean {
  return optionalIdentityKeysForEntity(entity).has(key);
}

export function allIdentityKeysForEntity(entity: GoogleAdsMetricEntity): Set<string> {
  return new Set([
    ...GOOGLE_ADS_IDENTITY_COLUMNS[entity].map((c) => c.key),
    ...GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS[entity].map((c) => c.key),
  ]);
}

export const GOOGLE_ADS_RECOMMENDED_METRIC_KEYS: Record<GoogleAdsMetricEntity, string[]> = {
  keyword: [
    "clicks",
    "conv_rate",
    "conversions",
    "avg_cpc",
    "cost_per_conv",
    "impressions",
    "ctr",
  ],
  campaign: [
    "impressions",
    "clicks",
    "ctr",
    "conversions",
    "conv_rate",
    "avg_cpc",
    "cost_per_conv",
  ],
  ad_group: [
    "impressions",
    "clicks",
    "ctr",
    "conversions",
    "conv_rate",
    "avg_cpc",
    "cost_per_conv",
  ],
  ad: ["impressions", "clicks", "ctr", "conversions", "conv_rate"],
};

export const GOOGLE_ADS_MAX_METRICS = 50;

export function defaultSelectedColumnKeys(
  entity: GoogleAdsMetricEntity,
  validKeys: Set<string>,
): string[] {
  const metrics = GOOGLE_ADS_RECOMMENDED_METRIC_KEYS[entity].filter((k) => validKeys.has(k));
  const fallback = ["impressions", "clicks", "ctr"].filter((k) => validKeys.has(k));
  const base = metrics.length > 0 ? metrics : fallback;
  const optional = GOOGLE_ADS_OPTIONAL_IDENTITY_COLUMNS[entity]
    .map((c) => c.key)
    .filter((k) => validKeys.has(k));
  return [...base, ...optional];
}

export function modifyColumnsTitle(entity: GoogleAdsMetricEntity): string {
  const labels: Record<GoogleAdsMetricEntity, string> = {
    campaign: "campaigns",
    ad_group: "ad groups",
    ad: "ads",
    keyword: "keywords",
  };
  return `Modify columns for ${labels[entity]}`;
}

import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";

export type TikTokAdsMetricsSort = {
  field: string;
  direction: "asc" | "desc";
};

export type TikTokAdsSortColumnOption = { key: string; labelKey: string; defaultLabel: string };

export type TikTokAdsSortColumnKind = "text" | "numeric";

const METRIC_KEYS: TikTokAdsSortColumnOption[] = [
  { key: "spend", labelKey: "digitalMarketing.tiktokAds.spend", defaultLabel: "Spend" },
  { key: "impressions", labelKey: "digitalMarketing.tiktokAds.impressions", defaultLabel: "Impressions" },
  { key: "clicks", labelKey: "digitalMarketing.tiktokAds.clicks", defaultLabel: "Clicks" },
  { key: "ctr", labelKey: "digitalMarketing.tiktokAds.ctr", defaultLabel: "CTR" },
  { key: "cpc", labelKey: "digitalMarketing.tiktokAds.cpc", defaultLabel: "CPC" },
  { key: "cpm", labelKey: "digitalMarketing.tiktokAds.cpm", defaultLabel: "CPM" },
  { key: "reach", labelKey: "digitalMarketing.tiktokAds.reach", defaultLabel: "Reach" },
];

const CAMPAIGN_SERVICE_SORT: TikTokAdsSortColumnOption[] = [
  {
    key: "service",
    labelKey: "digitalMarketing.tiktokAds.columnService",
    defaultLabel: "Service",
  },
  {
    key: "service_cpl",
    labelKey: "digitalMarketing.tiktokAds.columnCostPerLead",
    defaultLabel: "CPA",
  },
  {
    key: "service_converted_leads",
    labelKey: "digitalMarketing.tiktokAds.columnConvertedLeads",
    defaultLabel: "Conv. leads",
  },
];

const IDENTITY_BY_ENTITY: Record<TikTokAdsMetricEntity, TikTokAdsSortColumnOption[]> = {
  campaign: [
    ...CAMPAIGN_SERVICE_SORT,
    { key: "name", labelKey: "digitalMarketing.tiktokAds.name", defaultLabel: "Name" },
  ],
  adgroup: [
    { key: "name", labelKey: "digitalMarketing.tiktokAds.name", defaultLabel: "Name" },
    {
      key: "campaign_name",
      labelKey: "digitalMarketing.tiktokAds.campaignColumn",
      defaultLabel: "Campaign",
    },
  ],
  ad: [
    { key: "name", labelKey: "digitalMarketing.tiktokAds.name", defaultLabel: "Name" },
    {
      key: "adgroup_name",
      labelKey: "digitalMarketing.tiktokAds.adgroupColumn",
      defaultLabel: "Ad group",
    },
  ],
};

const TEXT_FIELDS = new Set(["name", "campaign_name", "adgroup_name", "service"]);

export function buildTikTokAdsSortColumnOptions(
  entity: TikTokAdsMetricEntity,
  selectedMetricKeys?: string[],
): TikTokAdsSortColumnOption[] {
  const metrics =
    selectedMetricKeys && selectedMetricKeys.length > 0
      ? METRIC_KEYS.filter((m) => selectedMetricKeys.includes(m.key))
      : METRIC_KEYS;
  return [...IDENTITY_BY_ENTITY[entity], ...metrics];
}

export function getTikTokAdsSortColumnKind(field: string): TikTokAdsSortColumnKind {
  return TEXT_FIELDS.has(field) ? "text" : "numeric";
}

export function defaultTikTokAdsSortDirection(kind: TikTokAdsSortColumnKind): "asc" | "desc" {
  return kind === "text" ? "asc" : "desc";
}

export function defaultTikTokAdsSort(_entity?: TikTokAdsMetricEntity): TikTokAdsMetricsSort {
  return { field: "spend", direction: "desc" };
}

export function resolveSortForOptions(
  current: TikTokAdsMetricsSort,
  options: TikTokAdsSortColumnOption[],
): TikTokAdsMetricsSort {
  if (options.length === 0) return current;
  if (options.some((o) => o.key === current.field)) {
    const direction = current.direction === "asc" ? "asc" : "desc";
    if (current.direction === direction) return current;
    return { field: current.field, direction };
  }
  const firstMetric = options.find((o) => !TEXT_FIELDS.has(o.key));
  const field = firstMetric?.key ?? options[0]?.key ?? "spend";
  const kind = getTikTokAdsSortColumnKind(field);
  return { field, direction: defaultTikTokAdsSortDirection(kind) };
}

export function sortDirectionLabelKeys(kind: TikTokAdsSortColumnKind): {
  descKey: string;
  ascKey: string;
  descDefault: string;
  ascDefault: string;
} {
  if (kind === "text") {
    return {
      descKey: "digitalMarketing.tiktokAds.sortDescText",
      ascKey: "digitalMarketing.tiktokAds.sortAscText",
      descDefault: "Z → A",
      ascDefault: "A → Z",
    };
  }
  return {
    descKey: "digitalMarketing.tiktokAds.sortDescNumeric",
    ascKey: "digitalMarketing.tiktokAds.sortAscNumeric",
    descDefault: "High → low",
    ascDefault: "Low → high",
  };
}

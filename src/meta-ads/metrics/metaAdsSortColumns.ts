import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";

export type MetaAdsMetricsSort = {
  field: string;
  direction: "asc" | "desc";
};

export type MetaAdsSortColumnOption = { key: string; labelKey: string; defaultLabel: string };

export type MetaAdsSortColumnKind = "text" | "numeric";

const METRIC_KEYS: MetaAdsSortColumnOption[] = [
  { key: "spend", labelKey: "digitalMarketing.metaAds.spend", defaultLabel: "Spend" },
  { key: "impressions", labelKey: "digitalMarketing.metaAds.impressions", defaultLabel: "Impressions" },
  { key: "clicks", labelKey: "digitalMarketing.metaAds.clicks", defaultLabel: "Clicks" },
  { key: "ctr", labelKey: "digitalMarketing.metaAds.ctr", defaultLabel: "CTR" },
  { key: "cpc", labelKey: "digitalMarketing.metaAds.cpc", defaultLabel: "CPC" },
  { key: "cpm", labelKey: "digitalMarketing.metaAds.cpm", defaultLabel: "CPM" },
  { key: "reach", labelKey: "digitalMarketing.metaAds.reach", defaultLabel: "Reach" },
];

const CAMPAIGN_SERVICE_SORT: MetaAdsSortColumnOption[] = [
  {
    key: "service",
    labelKey: "digitalMarketing.metaAds.columnService",
    defaultLabel: "Service",
  },
  {
    key: "service_cpl",
    labelKey: "digitalMarketing.metaAds.columnCostPerLead",
    defaultLabel: "CPA",
  },
  {
    key: "service_converted_leads",
    labelKey: "digitalMarketing.metaAds.columnConvertedLeads",
    defaultLabel: "Conv. leads",
  },
];

const IDENTITY_BY_ENTITY: Record<MetaAdsMetricEntity, MetaAdsSortColumnOption[]> = {
  campaign: [
    ...CAMPAIGN_SERVICE_SORT,
    { key: "name", labelKey: "digitalMarketing.metaAds.name", defaultLabel: "Name" },
  ],
  adset: [
    { key: "name", labelKey: "digitalMarketing.metaAds.name", defaultLabel: "Name" },
    {
      key: "campaign_name",
      labelKey: "digitalMarketing.metaAds.campaignColumn",
      defaultLabel: "Campaign",
    },
  ],
  ad: [
    { key: "name", labelKey: "digitalMarketing.metaAds.name", defaultLabel: "Name" },
    {
      key: "adset_name",
      labelKey: "digitalMarketing.metaAds.adsetColumn",
      defaultLabel: "Ad set",
    },
  ],
};

const TEXT_FIELDS = new Set(["name", "campaign_name", "adset_name", "service"]);

export function buildMetaAdsSortColumnOptions(
  entity: MetaAdsMetricEntity,
  selectedMetricKeys?: string[],
): MetaAdsSortColumnOption[] {
  const metrics =
    selectedMetricKeys && selectedMetricKeys.length > 0
      ? METRIC_KEYS.filter((m) => selectedMetricKeys.includes(m.key))
      : METRIC_KEYS;
  return [...IDENTITY_BY_ENTITY[entity], ...metrics];
}

export function getMetaAdsSortColumnKind(field: string): MetaAdsSortColumnKind {
  return TEXT_FIELDS.has(field) ? "text" : "numeric";
}

export function defaultMetaAdsSortDirection(kind: MetaAdsSortColumnKind): "asc" | "desc" {
  return kind === "text" ? "asc" : "desc";
}

export function defaultMetaAdsSort(_entity?: MetaAdsMetricEntity): MetaAdsMetricsSort {
  return { field: "spend", direction: "desc" };
}

export function resolveSortForOptions(
  current: MetaAdsMetricsSort,
  options: MetaAdsSortColumnOption[],
): MetaAdsMetricsSort {
  if (options.length === 0) return current;
  if (options.some((o) => o.key === current.field)) {
    return {
      field: current.field,
      direction: current.direction === "asc" ? "asc" : "desc",
    };
  }
  const firstMetric = options.find((o) => !TEXT_FIELDS.has(o.key));
  const field = firstMetric?.key ?? options[0]?.key ?? "spend";
  const kind = getMetaAdsSortColumnKind(field);
  return { field, direction: defaultMetaAdsSortDirection(kind) };
}

export function sortDirectionLabelKeys(kind: MetaAdsSortColumnKind): {
  descKey: string;
  ascKey: string;
  descDefault: string;
  ascDefault: string;
} {
  if (kind === "text") {
    return {
      descKey: "digitalMarketing.metaAds.sortDescText",
      ascKey: "digitalMarketing.metaAds.sortAscText",
      descDefault: "Z → A",
      ascDefault: "A → Z",
    };
  }
  return {
    descKey: "digitalMarketing.metaAds.sortDescNumeric",
    ascKey: "digitalMarketing.metaAds.sortAscNumeric",
    descDefault: "High → low",
    ascDefault: "Low → high",
  };
}

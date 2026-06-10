import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokMetricValueKind } from "@/tiktok-ads/metrics/formatTikTokMetricValue";

export type TikTokAdsMetricCatalogItem = {
  key: string;
  labelKey: string;
  defaultLabel: string;
  descriptionKey?: string;
  defaultDescription?: string;
  valueKind: TikTokMetricValueKind;
  entities: TikTokAdsMetricEntity[];
  defaultSelected: boolean;
  sortable: boolean;
};

export type TikTokAdsIdentityColumn = {
  key: string;
  labelKey: string;
  defaultLabel: string;
};

export type TikTokAdsMetricCatalogCategory = {
  id: string;
  labelKey: string;
  defaultLabel: string;
  metrics: TikTokAdsMetricCatalogItem[];
};

export type TikTokAdsMetricCatalogResponse = {
  max_metrics: number;
  identity_columns: TikTokAdsIdentityColumn[];
  recommended_keys: string[];
  recommended: TikTokAdsMetricCatalogCategory;
  categories: TikTokAdsMetricCatalogCategory[];
};

export const TIKTOK_ADS_MAX_METRICS = 20;

export const TIKTOK_ADS_DEFAULT_METRIC_KEYS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
] as const;

export const TIKTOK_ADS_ALL_METRIC_KEYS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
] as const;

const CORE_METRICS: TikTokAdsMetricCatalogItem[] = [
  {
    key: "spend",
    labelKey: "digitalMarketing.tiktokAds.spend",
    defaultLabel: "Spend",
    descriptionKey: "digitalMarketing.tiktokAds.metricSpendDesc",
    defaultDescription: "Amount spent",
    valueKind: "currency",
    entities: ["campaign", "adgroup", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "impressions",
    labelKey: "digitalMarketing.tiktokAds.impressions",
    defaultLabel: "Impressions",
    descriptionKey: "digitalMarketing.tiktokAds.metricImpressionsDesc",
    defaultDescription: "Times ads were shown",
    valueKind: "count",
    entities: ["campaign", "adgroup", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "clicks",
    labelKey: "digitalMarketing.tiktokAds.clicks",
    defaultLabel: "Clicks",
    descriptionKey: "digitalMarketing.tiktokAds.metricClicksDesc",
    defaultDescription: "Clicks on ads",
    valueKind: "count",
    entities: ["campaign", "adgroup", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "ctr",
    labelKey: "digitalMarketing.tiktokAds.ctr",
    defaultLabel: "CTR",
    descriptionKey: "digitalMarketing.tiktokAds.metricCtrDesc",
    defaultDescription: "Click-through rate",
    valueKind: "percent",
    entities: ["campaign", "adgroup", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "cpc",
    labelKey: "digitalMarketing.tiktokAds.cpc",
    defaultLabel: "CPC",
    descriptionKey: "digitalMarketing.tiktokAds.metricCpcDesc",
    defaultDescription: "Cost per click",
    valueKind: "currency",
    entities: ["campaign", "adgroup", "ad"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "cpm",
    labelKey: "digitalMarketing.tiktokAds.cpm",
    defaultLabel: "CPM",
    descriptionKey: "digitalMarketing.tiktokAds.metricCpmDesc",
    defaultDescription: "Cost per 1,000 impressions",
    valueKind: "currency",
    entities: ["campaign", "adgroup", "ad"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "reach",
    labelKey: "digitalMarketing.tiktokAds.reach",
    defaultLabel: "Reach",
    descriptionKey: "digitalMarketing.tiktokAds.metricReachDesc",
    defaultDescription: "Unique people reached",
    valueKind: "count",
    entities: ["campaign", "adgroup", "ad"],
    defaultSelected: false,
    sortable: true,
  },
];

export function getTikTokAdsCatalogMetricKeys(): Set<string> {
  return new Set(TIKTOK_ADS_ALL_METRIC_KEYS);
}

export function getTikTokAdsMetricsForEntity(
  entity: TikTokAdsMetricEntity,
): TikTokAdsMetricCatalogItem[] {
  return CORE_METRICS.filter((m) => m.entities.includes(entity));
}

export function getTikTokAdsIdentityColumns(entity: TikTokAdsMetricEntity): TikTokAdsIdentityColumn[] {
  if (entity === "campaign") {
    return [
      {
        key: "name",
        labelKey: "digitalMarketing.tiktokAds.name",
        defaultLabel: "Name",
      },
    ];
  }
  if (entity === "adgroup") {
    return [
      {
        key: "name",
        labelKey: "digitalMarketing.tiktokAds.name",
        defaultLabel: "Name",
      },
      {
        key: "campaign_name",
        labelKey: "digitalMarketing.tiktokAds.campaignColumn",
        defaultLabel: "Campaign",
      },
    ];
  }
  return [
    {
      key: "name",
      labelKey: "digitalMarketing.tiktokAds.name",
      defaultLabel: "Name",
    },
    {
      key: "adgroup_name",
      labelKey: "digitalMarketing.tiktokAds.adgroupColumn",
      defaultLabel: "Ad group",
    },
  ];
}

export function buildTikTokAdsMetricCatalogResponse(
  entity: TikTokAdsMetricEntity,
): TikTokAdsMetricCatalogResponse {
  const coreMetrics = CORE_METRICS.filter((m) => m.entities.includes(entity));
  const recommended = coreMetrics.filter((m) => m.defaultSelected);
  const categories: TikTokAdsMetricCatalogCategory[] = [
    {
      id: "performance",
      labelKey: "digitalMarketing.tiktokAds.catalogPerformance",
      defaultLabel: "Performance",
      metrics: coreMetrics,
    },
  ];
  return {
    max_metrics: TIKTOK_ADS_MAX_METRICS,
    identity_columns: getTikTokAdsIdentityColumns(entity),
    recommended_keys: [...TIKTOK_ADS_DEFAULT_METRIC_KEYS],
    recommended: {
      id: "recommended",
      labelKey: "digitalMarketing.tiktokAds.catalogRecommended",
      defaultLabel: "Recommended columns",
      metrics: recommended,
    },
    categories,
  };
}

export function resolveTikTokAdsMetricItems(
  selectedKeys: string[],
  entity: TikTokAdsMetricEntity,
): TikTokAdsMetricCatalogItem[] {
  const map = new Map(getTikTokAdsMetricsForEntity(entity).map((m) => [m.key, m]));
  return selectedKeys.map((k) => map.get(k)).filter((m): m is TikTokAdsMetricCatalogItem => Boolean(m));
}

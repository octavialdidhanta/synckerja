import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaMetricValueKind } from "@/meta-ads/metrics/formatMetaMetricValue";

export type MetaAdsMetricCatalogItem = {
  key: string;
  labelKey: string;
  defaultLabel: string;
  descriptionKey?: string;
  defaultDescription?: string;
  valueKind: MetaMetricValueKind;
  entities: MetaAdsMetricEntity[];
  defaultSelected: boolean;
  sortable: boolean;
};

export type MetaAdsIdentityColumn = {
  key: string;
  labelKey: string;
  defaultLabel: string;
};

export type MetaAdsMetricCatalogCategory = {
  id: string;
  labelKey: string;
  defaultLabel: string;
  metrics: MetaAdsMetricCatalogItem[];
};

export type MetaAdsMetricCatalogResponse = {
  max_metrics: number;
  identity_columns: MetaAdsIdentityColumn[];
  recommended_keys: string[];
  recommended: MetaAdsMetricCatalogCategory;
  categories: MetaAdsMetricCatalogCategory[];
};

export const META_ADS_MAX_METRICS = 20;

export const META_ADS_DEFAULT_METRIC_KEYS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
] as const;

export const META_ADS_ALL_METRIC_KEYS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
] as const;

const CORE_METRICS: MetaAdsMetricCatalogItem[] = [
  {
    key: "spend",
    labelKey: "digitalMarketing.metaAds.spend",
    defaultLabel: "Spend",
    descriptionKey: "digitalMarketing.metaAds.metricSpendDesc",
    defaultDescription: "Amount spent",
    valueKind: "currency",
    entities: ["campaign", "adset", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "impressions",
    labelKey: "digitalMarketing.metaAds.impressions",
    defaultLabel: "Impressions",
    descriptionKey: "digitalMarketing.metaAds.metricImpressionsDesc",
    defaultDescription: "Times ads were shown",
    valueKind: "count",
    entities: ["campaign", "adset", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "clicks",
    labelKey: "digitalMarketing.metaAds.clicks",
    defaultLabel: "Clicks",
    descriptionKey: "digitalMarketing.metaAds.metricClicksDesc",
    defaultDescription: "Clicks on ads",
    valueKind: "count",
    entities: ["campaign", "adset", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "ctr",
    labelKey: "digitalMarketing.metaAds.ctr",
    defaultLabel: "CTR",
    descriptionKey: "digitalMarketing.metaAds.metricCtrDesc",
    defaultDescription: "Click-through rate",
    valueKind: "percent",
    entities: ["campaign", "adset", "ad"],
    defaultSelected: true,
    sortable: true,
  },
  {
    key: "cpc",
    labelKey: "digitalMarketing.metaAds.cpc",
    defaultLabel: "CPC",
    descriptionKey: "digitalMarketing.metaAds.metricCpcDesc",
    defaultDescription: "Cost per click",
    valueKind: "currency",
    entities: ["campaign", "adset", "ad"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "cpm",
    labelKey: "digitalMarketing.metaAds.cpm",
    defaultLabel: "CPM",
    descriptionKey: "digitalMarketing.metaAds.metricCpmDesc",
    defaultDescription: "Cost per 1,000 impressions",
    valueKind: "currency",
    entities: ["campaign", "adset", "ad"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "reach",
    labelKey: "digitalMarketing.metaAds.reach",
    defaultLabel: "Reach",
    descriptionKey: "digitalMarketing.metaAds.metricReachDesc",
    defaultDescription: "Unique people reached",
    valueKind: "count",
    entities: ["campaign", "adset", "ad"],
    defaultSelected: false,
    sortable: true,
  },
];

export function getMetaAdsCatalogMetricKeys(): Set<string> {
  return new Set(META_ADS_ALL_METRIC_KEYS);
}

export function getMetaAdsMetricsForEntity(entity: MetaAdsMetricEntity): MetaAdsMetricCatalogItem[] {
  return CORE_METRICS.filter((m) => m.entities.includes(entity));
}

export function getMetaAdsIdentityColumns(entity: MetaAdsMetricEntity): MetaAdsIdentityColumn[] {
  if (entity === "campaign") {
    return [
      {
        key: "name",
        labelKey: "digitalMarketing.metaAds.name",
        defaultLabel: "Name",
      },
    ];
  }
  if (entity === "adset") {
    return [
      {
        key: "name",
        labelKey: "digitalMarketing.metaAds.name",
        defaultLabel: "Name",
      },
      {
        key: "campaign_name",
        labelKey: "digitalMarketing.metaAds.campaignColumn",
        defaultLabel: "Campaign",
      },
    ];
  }
  return [
    {
      key: "name",
      labelKey: "digitalMarketing.metaAds.name",
      defaultLabel: "Name",
    },
    {
      key: "adset_name",
      labelKey: "digitalMarketing.metaAds.adsetColumn",
      defaultLabel: "Ad set",
    },
  ];
}

export function buildMetaAdsMetricCatalogResponse(
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogResponse {
  const metrics = getMetaAdsMetricsForEntity(entity);
  const recommended = metrics.filter((m) => m.defaultSelected);
  return {
    max_metrics: META_ADS_MAX_METRICS,
    identity_columns: getMetaAdsIdentityColumns(entity),
    recommended_keys: [...META_ADS_DEFAULT_METRIC_KEYS],
    recommended: {
      id: "recommended",
      labelKey: "digitalMarketing.metaAds.catalogRecommended",
      defaultLabel: "Recommended columns",
      metrics: recommended,
    },
    categories: [
      {
        id: "performance",
        labelKey: "digitalMarketing.metaAds.catalogPerformance",
        defaultLabel: "Performance",
        metrics,
      },
    ],
  };
}

export function resolveMetaAdsMetricItems(
  selectedKeys: string[],
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogItem[] {
  const map = new Map(getMetaAdsMetricsForEntity(entity).map((m) => [m.key, m]));
  return selectedKeys.map((k) => map.get(k)).filter((m): m is MetaAdsMetricCatalogItem => Boolean(m));
}

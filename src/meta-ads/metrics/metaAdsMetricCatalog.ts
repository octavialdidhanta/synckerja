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

/** Always shown after Name — not user-selectable in Modify columns. */
export const META_ADS_PINNED_METRIC_KEYS = ["spend"] as const;

export const META_ADS_DEFAULT_METRIC_KEYS = ["impressions", "clicks", "ctr"] as const;

export function isMetaAdsPinnedMetricKey(key: string): boolean {
  return (META_ADS_PINNED_METRIC_KEYS as readonly string[]).includes(String(key ?? "").trim());
}

export function stripMetaAdsPinnedMetricKeys(keys: string[]): string[] {
  return keys.filter((k) => !isMetaAdsPinnedMetricKey(k));
}

export const META_ADS_SYNCKERJA_METRIC_KEYS = [
  "traffic_total_visit_page",
  "traffic_visit_click_rate",
  "leads_total",
  "leads_visit_rate",
  "leads_cost_per_lead",
] as const;

export const META_ADS_ALL_METRIC_KEYS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
  ...META_ADS_SYNCKERJA_METRIC_KEYS,
] as const;

export function isMetaAdsSynckerjaMetricKey(key: string): boolean {
  return (META_ADS_SYNCKERJA_METRIC_KEYS as readonly string[]).includes(String(key ?? "").trim());
}

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

const SYNCKERJA_METRICS: MetaAdsMetricCatalogItem[] = [
  {
    key: "traffic_total_visit_page",
    labelKey: "digitalMarketing.metaAds.trafficTotalVisitPage",
    defaultLabel: "Total Visit Page",
    defaultDescription:
      "Unique sessions from Traffic where utm_campaign matches this campaign name.",
    valueKind: "count",
    entities: ["campaign"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "traffic_visit_click_rate",
    labelKey: "digitalMarketing.metaAds.trafficVisitClickRate",
    defaultLabel: "Visit / Click %",
    defaultDescription: "Total Visit Page ÷ Clicks × 100 for this campaign.",
    valueKind: "percent",
    entities: ["campaign"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "leads_total",
    labelKey: "digitalMarketing.metaAds.leadsTotal",
    defaultLabel: "Total Leads",
    defaultDescription:
      "Leads where utm_campaign exactly matches this campaign name (created_at in date range).",
    valueKind: "count",
    entities: ["campaign"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "leads_visit_rate",
    labelKey: "digitalMarketing.metaAds.leadsVisitRate",
    defaultLabel: "Leads / Visit %",
    defaultDescription: "Total Leads ÷ Total Visit Page × 100 for this campaign.",
    valueKind: "percent",
    entities: ["campaign"],
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "leads_cost_per_lead",
    labelKey: "digitalMarketing.metaAds.leadsCostPerLead",
    defaultLabel: "Cost / Leads",
    defaultDescription: "Campaign spend ÷ Total Leads for this campaign.",
    valueKind: "currency",
    entities: ["campaign"],
    defaultSelected: false,
    sortable: true,
  },
];

export function getMetaAdsCatalogMetricKeys(): Set<string> {
  return new Set(META_ADS_ALL_METRIC_KEYS);
}

export function getMetaAdsMetricsForEntity(entity: MetaAdsMetricEntity): MetaAdsMetricCatalogItem[] {
  const core = CORE_METRICS.filter((m) => m.entities.includes(entity));
  if (entity !== "campaign") return core;
  return [...core, ...SYNCKERJA_METRICS];
}

/** Table Modify columns — excludes pinned metrics always shown in the grid. */
export function getMetaAdsSelectableMetricsForEntity(
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogItem[] {
  return getMetaAdsMetricsForEntity(entity).filter((m) => !isMetaAdsPinnedMetricKey(m.key));
}

export function getMetaAdsPinnedMetricColumns(_entity: MetaAdsMetricEntity): MetaAdsIdentityColumn[] {
  return [
    {
      key: "spend",
      labelKey: "digitalMarketing.metaAds.cost",
      defaultLabel: "Cost",
    },
  ];
}

function getMetaAdsCampaignServiceColumns(): MetaAdsIdentityColumn[] {
  return [
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
}

export function getMetaAdsSynckerjaMetricsForEntity(
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogItem[] {
  if (entity !== "campaign") return [];
  return SYNCKERJA_METRICS;
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

/** Locked table column order: Name then Cost, plus campaign service cols / parent names. */
export function getMetaAdsLockedTableColumns(entity: MetaAdsMetricEntity): MetaAdsIdentityColumn[] {
  const pinned = getMetaAdsPinnedMetricColumns(entity);
  const identity = getMetaAdsIdentityColumns(entity);
  const name = identity.find((c) => c.key === "name");
  const parents = identity.filter((c) => c.key !== "name");
  if (!name) return [...identity, ...pinned];
  if (entity === "campaign") {
    return [...getMetaAdsCampaignServiceColumns(), name, ...pinned];
  }
  return [name, ...pinned, ...parents];
}

export function buildMetaAdsMetricCatalogResponse(
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogResponse {
  const coreMetrics = getMetaAdsSelectableMetricsForEntity(entity).filter((m) =>
    CORE_METRICS.some((core) => core.key === m.key),
  );
  const synckerjaMetrics = getMetaAdsSynckerjaMetricsForEntity(entity);
  const recommended = coreMetrics.filter((m) => m.defaultSelected);
  const categories: MetaAdsMetricCatalogCategory[] = [
    {
      id: "performance",
      labelKey: "digitalMarketing.metaAds.catalogPerformance",
      defaultLabel: "Performance",
      metrics: coreMetrics,
    },
  ];
  if (synckerjaMetrics.length > 0) {
    categories.push({
      id: "synckerja_metrics",
      labelKey: "digitalMarketing.metaAds.catalogSynckerja",
      defaultLabel: "Synckerja metrics",
      metrics: synckerjaMetrics,
    });
  }
  return {
    max_metrics: META_ADS_MAX_METRICS,
    identity_columns: [
      ...getMetaAdsIdentityColumns(entity),
      ...getMetaAdsPinnedMetricColumns(entity),
    ],
    recommended_keys: [...META_ADS_DEFAULT_METRIC_KEYS],
    recommended: {
      id: "recommended",
      labelKey: "digitalMarketing.metaAds.catalogRecommended",
      defaultLabel: "Recommended columns",
      metrics: recommended,
    },
    categories,
  };
}

export function resolveMetaAdsMetricItems(
  selectedKeys: string[],
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogItem[] {
  const map = new Map(getMetaAdsSelectableMetricsForEntity(entity).map((m) => [m.key, m]));
  return stripMetaAdsPinnedMetricKeys(selectedKeys)
    .map((k) => map.get(k))
    .filter((m): m is MetaAdsMetricCatalogItem => Boolean(m));
}

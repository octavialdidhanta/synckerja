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

export const META_ADS_MAX_METRICS = 30;

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

export const META_ADS_CPAS_PRESET_METRIC_KEYS = [
  "delivery",
  "budget",
  "reach",
  "impressions",
  "frequency",
  "cpm",
  "cpc",
  "ctr",
  "clicks",
  "click_to_view_rate",
  "content_views",
  "view_to_atc_rate",
  "adds_to_cart",
  "cost_per_atc",
  "atc_conversion_value",
  "purchases",
  "atc_to_purchase_rate",
  "purchase_conversion_value",
  "aov",
  "cost_per_purchase",
  "purchase_roas",
] as const;

/** Row fields that are not account totals, so they stay out of the summary cards. */
export const META_ADS_SUMMARY_EXCLUDED_METRIC_KEYS = ["delivery", "budget"] as const;

export const META_ADS_ALL_METRIC_KEYS = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "cpm",
  "reach",
  "frequency",
  "delivery",
  "budget",
  "click_to_view_rate",
  "content_views",
  "view_to_atc_rate",
  "adds_to_cart",
  "cost_per_atc",
  "atc_conversion_value",
  "purchases",
  "atc_to_purchase_rate",
  "purchase_conversion_value",
  "aov",
  "cost_per_purchase",
  "purchase_roas",
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
    defaultLabel: "Link clicks",
    descriptionKey: "digitalMarketing.metaAds.metricClicksDesc",
    defaultDescription: "Clicks on links in the ad",
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
    defaultDescription: "Link clicks divided by impressions",
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
    defaultDescription: "Cost per link click",
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

const ALL_ENTITIES: MetaAdsMetricCatalogItem["entities"] = ["campaign", "adset", "ad"];

const DELIVERY_BUDGET_METRICS: MetaAdsMetricCatalogItem[] = [
  {
    key: "delivery",
    labelKey: "digitalMarketing.metaAds.delivery",
    defaultLabel: "Delivery",
    descriptionKey: "digitalMarketing.metaAds.metricDeliveryDesc",
    defaultDescription: "Active or off, from the campaign, ad set, or ad status",
    valueKind: "text",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "budget",
    labelKey: "digitalMarketing.metaAds.budget",
    defaultLabel: "Budget",
    descriptionKey: "digitalMarketing.metaAds.metricBudgetDesc",
    defaultDescription: "Daily budget, or lifetime budget when the daily budget is not set",
    valueKind: "currency",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "frequency",
    labelKey: "digitalMarketing.metaAds.frequency",
    defaultLabel: "Frequency",
    descriptionKey: "digitalMarketing.metaAds.metricFrequencyDesc",
    defaultDescription: "Average times each person saw the ad",
    valueKind: "decimal",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
];

const CPAS_METRICS: MetaAdsMetricCatalogItem[] = [
  {
    key: "click_to_view_rate",
    labelKey: "digitalMarketing.metaAds.clickToViewRate",
    defaultLabel: "% Click to View",
    descriptionKey: "digitalMarketing.metaAds.metricClickToViewDesc",
    defaultDescription: "Content views with shared items divided by link clicks",
    valueKind: "percent",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "content_views",
    labelKey: "digitalMarketing.metaAds.contentViews",
    defaultLabel: "Content views",
    descriptionKey: "digitalMarketing.metaAds.metricContentViewsDesc",
    defaultDescription: "Content views with shared items",
    valueKind: "count",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "view_to_atc_rate",
    labelKey: "digitalMarketing.metaAds.viewToAtcRate",
    defaultLabel: "% View to ATC",
    descriptionKey: "digitalMarketing.metaAds.metricViewToAtcDesc",
    defaultDescription: "Adds to cart with shared items divided by content views",
    valueKind: "percent",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "adds_to_cart",
    labelKey: "digitalMarketing.metaAds.addsToCart",
    defaultLabel: "Adds to cart",
    descriptionKey: "digitalMarketing.metaAds.metricAddsToCartDesc",
    defaultDescription: "Adds to cart with shared items",
    valueKind: "count",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "cost_per_atc",
    labelKey: "digitalMarketing.metaAds.costPerAtc",
    defaultLabel: "Cost/ATC",
    descriptionKey: "digitalMarketing.metaAds.metricCostPerAtcDesc",
    defaultDescription: "Amount spent divided by adds to cart with shared items",
    valueKind: "currency",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "atc_conversion_value",
    labelKey: "digitalMarketing.metaAds.atcConversionValue",
    defaultLabel: "ATC conversion value",
    descriptionKey: "digitalMarketing.metaAds.metricAtcConversionValueDesc",
    defaultDescription: "Adds to cart conversion value for shared items only",
    valueKind: "currency",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "purchases",
    labelKey: "digitalMarketing.metaAds.purchases",
    defaultLabel: "Purchases",
    descriptionKey: "digitalMarketing.metaAds.metricPurchasesDesc",
    defaultDescription: "Purchases with shared items",
    valueKind: "count",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "atc_to_purchase_rate",
    labelKey: "digitalMarketing.metaAds.atcToPurchaseRate",
    defaultLabel: "% ATC to Purchase",
    descriptionKey: "digitalMarketing.metaAds.metricAtcToPurchaseDesc",
    defaultDescription: "Purchases with shared items divided by adds to cart",
    valueKind: "percent",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "purchase_conversion_value",
    labelKey: "digitalMarketing.metaAds.purchaseConversionValue",
    defaultLabel: "Purchase conversion value",
    descriptionKey: "digitalMarketing.metaAds.metricPurchaseConversionValueDesc",
    defaultDescription: "Purchases conversion value for shared items only",
    valueKind: "currency",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "aov",
    labelKey: "digitalMarketing.metaAds.aov",
    defaultLabel: "AOV",
    descriptionKey: "digitalMarketing.metaAds.metricAovDesc",
    defaultDescription: "Purchase conversion value divided by purchases",
    valueKind: "currency",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "cost_per_purchase",
    labelKey: "digitalMarketing.metaAds.costPerPurchase",
    defaultLabel: "Cost/Purchase",
    descriptionKey: "digitalMarketing.metaAds.metricCostPerPurchaseDesc",
    defaultDescription: "Amount spent divided by purchases with shared items",
    valueKind: "currency",
    entities: ALL_ENTITIES,
    defaultSelected: false,
    sortable: true,
  },
  {
    key: "purchase_roas",
    labelKey: "digitalMarketing.metaAds.purchaseRoas",
    defaultLabel: "Purchase ROAS",
    descriptionKey: "digitalMarketing.metaAds.metricPurchaseRoasDesc",
    defaultDescription: "Purchase conversion value divided by amount spent",
    valueKind: "decimal",
    entities: ALL_ENTITIES,
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
  const performance = [...CORE_METRICS, ...DELIVERY_BUDGET_METRICS].filter((m) =>
    m.entities.includes(entity),
  );
  const cpas = CPAS_METRICS.filter((m) => m.entities.includes(entity));
  if (entity !== "campaign") return [...performance, ...cpas];
  return [...performance, ...cpas, ...SYNCKERJA_METRICS];
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
      defaultLabel: "Service/products",
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
  if (entity === "ad") {
    return [
      name,
      {
        key: "running_days",
        labelKey: "digitalMarketing.metaAds.runningDays",
        defaultLabel: "Days",
      },
      {
        key: "ad_toggle",
        labelKey: "digitalMarketing.metaAds.adToggle",
        defaultLabel: "On",
      },
      ...pinned,
      ...parents,
    ];
  }
  return [name, ...pinned, ...parents];
}

export function buildMetaAdsMetricCatalogResponse(
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogResponse {
  const selectable = getMetaAdsSelectableMetricsForEntity(entity);
  const performanceKeys = new Set(
    [...CORE_METRICS, ...DELIVERY_BUDGET_METRICS].map((metric) => metric.key),
  );
  const cpasKeys = new Set(CPAS_METRICS.map((metric) => metric.key));
  const coreMetrics = selectable.filter((metric) => performanceKeys.has(metric.key));
  const cpasMetrics = selectable.filter((metric) => cpasKeys.has(metric.key));
  const synckerjaMetrics = getMetaAdsSynckerjaMetricsForEntity(entity);
  const recommended = coreMetrics.filter((m) => m.defaultSelected);
  const categories: MetaAdsMetricCatalogCategory[] = [
    {
      id: "performance",
      labelKey: "digitalMarketing.metaAds.catalogPerformance",
      defaultLabel: "Performance",
      metrics: coreMetrics,
    },
    {
      id: "cpas",
      labelKey: "digitalMarketing.metaAds.catalogCpas",
      defaultLabel: "CPAS",
      metrics: cpasMetrics,
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

/** AOV sits immediately left of Cost/Purchase when both columns are visible. */
function placeAovBeforeCostPerPurchase(keys: string[]): string[] {
  const withoutAov = keys.filter((key) => key !== "aov");
  const costIndex = withoutAov.indexOf("cost_per_purchase");
  if (costIndex < 0 || !keys.includes("aov")) return keys;
  const next = [...withoutAov];
  next.splice(costIndex, 0, "aov");
  return next;
}

export function resolveMetaAdsMetricItems(
  selectedKeys: string[],
  entity: MetaAdsMetricEntity,
): MetaAdsMetricCatalogItem[] {
  const map = new Map(getMetaAdsSelectableMetricsForEntity(entity).map((m) => [m.key, m]));
  return stripMetaAdsPinnedMetricKeys(placeAovBeforeCostPerPurchase(selectedKeys))
    .map((k) => map.get(k))
    .filter((m): m is MetaAdsMetricCatalogItem => Boolean(m));
}

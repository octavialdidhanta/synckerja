import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  getMetaAdsLockedTableColumns,
  stripMetaAdsPinnedMetricKeys,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";

export type MetaAdsMetricsSort = {
  field: string;
  direction: "asc" | "desc";
};

export type MetaAdsSortColumnOption = { key: string; labelKey: string; defaultLabel: string };

export type MetaAdsSortColumnKind = "text" | "numeric";

const METRIC_KEYS: MetaAdsSortColumnOption[] = [
  { key: "impressions", labelKey: "digitalMarketing.metaAds.impressions", defaultLabel: "Impressions" },
  { key: "clicks", labelKey: "digitalMarketing.metaAds.clicks", defaultLabel: "Link clicks" },
  { key: "ctr", labelKey: "digitalMarketing.metaAds.ctr", defaultLabel: "CTR" },
  { key: "cpc", labelKey: "digitalMarketing.metaAds.cpc", defaultLabel: "CPC" },
  { key: "cpm", labelKey: "digitalMarketing.metaAds.cpm", defaultLabel: "CPM" },
  { key: "reach", labelKey: "digitalMarketing.metaAds.reach", defaultLabel: "Reach" },
  { key: "frequency", labelKey: "digitalMarketing.metaAds.frequency", defaultLabel: "Frequency" },
  { key: "delivery", labelKey: "digitalMarketing.metaAds.delivery", defaultLabel: "Delivery" },
  { key: "budget", labelKey: "digitalMarketing.metaAds.budget", defaultLabel: "Budget" },
  {
    key: "click_to_view_rate",
    labelKey: "digitalMarketing.metaAds.clickToViewRate",
    defaultLabel: "% Click to View",
  },
  {
    key: "content_views",
    labelKey: "digitalMarketing.metaAds.contentViews",
    defaultLabel: "Content views",
  },
  {
    key: "view_to_atc_rate",
    labelKey: "digitalMarketing.metaAds.viewToAtcRate",
    defaultLabel: "% View to ATC",
  },
  {
    key: "adds_to_cart",
    labelKey: "digitalMarketing.metaAds.addsToCart",
    defaultLabel: "Adds to cart",
  },
  { key: "cost_per_atc", labelKey: "digitalMarketing.metaAds.costPerAtc", defaultLabel: "Cost/ATC" },
  {
    key: "atc_conversion_value",
    labelKey: "digitalMarketing.metaAds.atcConversionValue",
    defaultLabel: "ATC conversion value",
  },
  { key: "purchases", labelKey: "digitalMarketing.metaAds.purchases", defaultLabel: "Purchases" },
  {
    key: "atc_to_purchase_rate",
    labelKey: "digitalMarketing.metaAds.atcToPurchaseRate",
    defaultLabel: "% ATC to Purchase",
  },
  {
    key: "purchase_conversion_value",
    labelKey: "digitalMarketing.metaAds.purchaseConversionValue",
    defaultLabel: "Purchase conversion value",
  },
  { key: "aov", labelKey: "digitalMarketing.metaAds.aov", defaultLabel: "AOV" },
  {
    key: "cost_per_purchase",
    labelKey: "digitalMarketing.metaAds.costPerPurchase",
    defaultLabel: "Cost/Purchase",
  },
  {
    key: "purchase_roas",
    labelKey: "digitalMarketing.metaAds.purchaseRoas",
    defaultLabel: "Purchase ROAS",
  },
  {
    key: "traffic_total_visit_page",
    labelKey: "digitalMarketing.metaAds.trafficTotalVisitPage",
    defaultLabel: "Total Visit Page",
  },
  {
    key: "traffic_visit_click_rate",
    labelKey: "digitalMarketing.metaAds.trafficVisitClickRate",
    defaultLabel: "Visit / Click %",
  },
  {
    key: "leads_total",
    labelKey: "digitalMarketing.metaAds.leadsTotal",
    defaultLabel: "Total Leads",
  },
  {
    key: "leads_visit_rate",
    labelKey: "digitalMarketing.metaAds.leadsVisitRate",
    defaultLabel: "Leads / Visit %",
  },
  {
    key: "leads_cost_per_lead",
    labelKey: "digitalMarketing.metaAds.leadsCostPerLead",
    defaultLabel: "Cost / Leads",
  },
];

const TEXT_FIELDS = new Set(["name", "campaign_name", "adset_name", "service", "delivery", "ad_toggle"]);

const CAMPAIGN_ONLY_SORT_KEYS = new Set([
  "traffic_total_visit_page",
  "traffic_visit_click_rate",
  "leads_total",
  "leads_visit_rate",
  "leads_cost_per_lead",
]);

export function buildMetaAdsSortColumnOptions(
  entity: MetaAdsMetricEntity,
  selectedMetricKeys?: string[],
): MetaAdsSortColumnOption[] {
  const locked = getMetaAdsLockedTableColumns(entity).map((c) => ({
    key: c.key,
    labelKey: c.labelKey,
    defaultLabel: c.defaultLabel,
  }));
  const allowedMetrics = METRIC_KEYS.filter(
    (m) => entity === "campaign" || !CAMPAIGN_ONLY_SORT_KEYS.has(m.key),
  );
  const selected = selectedMetricKeys
    ? stripMetaAdsPinnedMetricKeys(selectedMetricKeys)
    : undefined;
  const metrics =
    selected && selected.length > 0
      ? allowedMetrics.filter((m) => selected.includes(m.key))
      : allowedMetrics;
  return [...locked, ...metrics];
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

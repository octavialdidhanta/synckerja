import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";

/** Raw counts returned by the edge function. Keep these aligned with the parser. */

export const BREAKDOWN_RAW_METRIC_KEYS = [
  "impressions",
  "reach",
  "spend",
  "inline_link_clicks",
  "clicks",
  "unique_clicks",
  "outbound_clicks",
  "unique_outbound_clicks",
  "content_views",
  "adds_to_cart",
  "purchases",
  "atc_conversion_value",
  "purchase_conversion_value",
] as const;

/** Rates and costs Ads Manager shows beside those counts. Computed on the client. */

export const BREAKDOWN_DERIVED_METRIC_KEYS = [
  "frequency",
  "cpm",
  "ctr",
  "cpc",
  "ctr_all",
  "cpc_all",
  "unique_ctr",
  "cost_per_unique_click",
  "outbound_ctr",
  "cost_per_outbound_click",
  "unique_outbound_ctr",
  "cost_per_unique_outbound_click",
  "click_to_view_rate",
  "view_to_atc_rate",
  "cost_per_atc",
  "atc_to_purchase_rate",
  "cost_per_purchase",
  "aov",
  "purchase_roas",
] as const;

export const BREAKDOWN_METRIC_KEYS = [
  "impressions",
  "reach",
  "frequency",
  "spend",
  "cpm",
  "inline_link_clicks",
  "cpc",
  "ctr",
  "clicks",
  "ctr_all",
  "cpc_all",
  "unique_clicks",
  "unique_ctr",
  "cost_per_unique_click",
  "outbound_clicks",
  "outbound_ctr",
  "cost_per_outbound_click",
  "unique_outbound_clicks",
  "unique_outbound_ctr",
  "cost_per_unique_outbound_click",
  "content_views",
  "click_to_view_rate",
  "adds_to_cart",
  "view_to_atc_rate",
  "cost_per_atc",
  "atc_conversion_value",
  "purchases",
  "atc_to_purchase_rate",
  "purchase_conversion_value",
  "aov",
  "cost_per_purchase",
  "purchase_roas",
] as const;

export type BreakdownRawMetricKey = (typeof BREAKDOWN_RAW_METRIC_KEYS)[number];

export type BreakdownMetricKey = (typeof BREAKDOWN_METRIC_KEYS)[number];

export type BreakdownMetricSlot = BreakdownMetricKey | "none";

export const BREAKDOWN_METRIC_COLORS = ["#1877F2", "#8ECAFF", "#5B9BFF", "#B7D4F8"] as const;

export const BREAKDOWN_NONE_COLOR = "#B0B3B8";

export const BREAKDOWN_MAX_SLOTS = 4;

export const BREAKDOWN_METRIC_LABELS: Record<
  BreakdownMetricKey,
  { labelKey: string; defaultLabel: string }
> = {
  impressions: {
    labelKey: "digitalMarketing.metaAds.impressions",
    defaultLabel: "Impressions",
  },
  reach: {
    labelKey: "digitalMarketing.metaAds.reach",
    defaultLabel: "Reach",
  },
  frequency: {
    labelKey: "digitalMarketing.metaAds.frequency",
    defaultLabel: "Frequency",
  },
  spend: {
    labelKey: "digitalMarketing.metaAds.spend",
    defaultLabel: "Spend",
  },
  cpm: {
    labelKey: "digitalMarketing.metaAds.cpm",
    defaultLabel: "CPM",
  },
  inline_link_clicks: {
    labelKey: "digitalMarketing.metaAds.clicks",
    defaultLabel: "Link clicks",
  },
  cpc: {
    labelKey: "digitalMarketing.metaAds.breakdownCpcLink",
    defaultLabel: "CPC (Link)",
  },
  ctr: {
    labelKey: "digitalMarketing.metaAds.breakdownCtrLink",
    defaultLabel: "CTR (Link)",
  },
  clicks: {
    labelKey: "digitalMarketing.metaAds.breakdownClicksAll",
    defaultLabel: "Clicks (All)",
  },
  ctr_all: {
    labelKey: "digitalMarketing.metaAds.breakdownCtrAll",
    defaultLabel: "CTR (All)",
  },
  cpc_all: {
    labelKey: "digitalMarketing.metaAds.breakdownCpcAll",
    defaultLabel: "CPC (All)",
  },
  unique_clicks: {
    labelKey: "digitalMarketing.metaAds.breakdownUniqueClicks",
    defaultLabel: "Unique Clicks (All)",
  },
  unique_ctr: {
    labelKey: "digitalMarketing.metaAds.breakdownUniqueCtr",
    defaultLabel: "Unique CTR (All)",
  },
  cost_per_unique_click: {
    labelKey: "digitalMarketing.metaAds.breakdownCostPerUniqueClick",
    defaultLabel: "Cost per Unique Click",
  },
  outbound_clicks: {
    labelKey: "digitalMarketing.metaAds.breakdownOutboundClicks",
    defaultLabel: "Clicks (Outbound)",
  },
  outbound_ctr: {
    labelKey: "digitalMarketing.metaAds.breakdownOutboundCtr",
    defaultLabel: "Outbound CTR",
  },
  cost_per_outbound_click: {
    labelKey: "digitalMarketing.metaAds.breakdownCostPerOutboundClick",
    defaultLabel: "Cost per Outbound Click",
  },
  unique_outbound_clicks: {
    labelKey: "digitalMarketing.metaAds.breakdownUniqueOutbound",
    defaultLabel: "Unique Clicks (Outbound)",
  },
  unique_outbound_ctr: {
    labelKey: "digitalMarketing.metaAds.breakdownUniqueOutboundCtr",
    defaultLabel: "Unique Outbound CTR",
  },
  cost_per_unique_outbound_click: {
    labelKey: "digitalMarketing.metaAds.breakdownCostPerUniqueOutboundClick",
    defaultLabel: "Cost per Unique Outbound Click",
  },
  content_views: {
    labelKey: "digitalMarketing.metaAds.contentViews",
    defaultLabel: "Content views",
  },
  click_to_view_rate: {
    labelKey: "digitalMarketing.metaAds.clickToViewRate",
    defaultLabel: "% Click to View",
  },
  adds_to_cart: {
    labelKey: "digitalMarketing.metaAds.addsToCart",
    defaultLabel: "Adds to cart",
  },
  view_to_atc_rate: {
    labelKey: "digitalMarketing.metaAds.viewToAtcRate",
    defaultLabel: "% View to ATC",
  },
  cost_per_atc: {
    labelKey: "digitalMarketing.metaAds.costPerAtc",
    defaultLabel: "Cost/ATC",
  },
  atc_conversion_value: {
    labelKey: "digitalMarketing.metaAds.atcConversionValue",
    defaultLabel: "ATC conversion value",
  },
  purchases: {
    labelKey: "digitalMarketing.metaAds.purchases",
    defaultLabel: "Purchases",
  },
  atc_to_purchase_rate: {
    labelKey: "digitalMarketing.metaAds.atcToPurchaseRate",
    defaultLabel: "% ATC to Purchase",
  },
  purchase_conversion_value: {
    labelKey: "digitalMarketing.metaAds.purchaseConversionValue",
    defaultLabel: "Purchase conversion value",
  },
  aov: {
    labelKey: "digitalMarketing.metaAds.aov",
    defaultLabel: "AOV",
  },
  cost_per_purchase: {
    labelKey: "digitalMarketing.metaAds.costPerPurchase",
    defaultLabel: "Cost/Purchase",
  },
  purchase_roas: {
    labelKey: "digitalMarketing.metaAds.purchaseRoas",
    defaultLabel: "Purchase ROAS",
  },
};

const CURRENCY_METRICS = new Set<BreakdownMetricKey>([
  "spend",
  "cpm",
  "cpc",
  "cpc_all",
  "cost_per_unique_click",
  "cost_per_outbound_click",
  "cost_per_unique_outbound_click",
  "cost_per_atc",
  "atc_conversion_value",
  "purchase_conversion_value",
  "aov",
  "cost_per_purchase",
]);

const PERCENT_METRICS = new Set<BreakdownMetricKey>([
  "ctr",
  "ctr_all",
  "unique_ctr",
  "outbound_ctr",
  "unique_outbound_ctr",
  "click_to_view_rate",
  "view_to_atc_rate",
  "atc_to_purchase_rate",
]);

export function breakdownMetricKind(metric: BreakdownMetricKey): "count" | "currency" | "percent" | "decimal" {
  if (PERCENT_METRICS.has(metric)) return "percent";
  if (CURRENCY_METRICS.has(metric)) return "currency";
  if (metric === "frequency" || metric === "purchase_roas") return "decimal";
  return "count";
}

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

export function breakdownDerivedMetrics(
  raw: Record<BreakdownRawMetricKey, number>,
): Record<(typeof BREAKDOWN_DERIVED_METRIC_KEYS)[number], number> {
  return {
    frequency: ratio(raw.impressions, raw.reach),
    cpm: ratio(raw.spend, raw.impressions) * 1000,
    ctr: ratio(raw.inline_link_clicks, raw.impressions),
    cpc: ratio(raw.spend, raw.inline_link_clicks),
    ctr_all: ratio(raw.clicks, raw.impressions),
    cpc_all: ratio(raw.spend, raw.clicks),
    unique_ctr: ratio(raw.unique_clicks, raw.reach),
    cost_per_unique_click: ratio(raw.spend, raw.unique_clicks),
    outbound_ctr: ratio(raw.outbound_clicks, raw.impressions),
    cost_per_outbound_click: ratio(raw.spend, raw.outbound_clicks),
    unique_outbound_ctr: ratio(raw.unique_outbound_clicks, raw.reach),
    cost_per_unique_outbound_click: ratio(raw.spend, raw.unique_outbound_clicks),
    click_to_view_rate: ratio(raw.content_views, raw.inline_link_clicks),
    view_to_atc_rate: ratio(raw.adds_to_cart, raw.content_views),
    cost_per_atc: ratio(raw.spend, raw.adds_to_cart),
    atc_to_purchase_rate: ratio(raw.purchases, raw.adds_to_cart),
    cost_per_purchase: ratio(raw.spend, raw.purchases),
    aov: ratio(raw.purchase_conversion_value, raw.purchases),
    purchase_roas: ratio(raw.purchase_conversion_value, raw.spend),
  };
}

export function formatBreakdownCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  }
  if (abs >= 1000) {
    return `${sign}${(abs / 1000).toFixed(2).replace(/\.00$/, "")}K`;
  }
  return String(Math.round(value));
}

export function formatBreakdownAxis(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatBreakdownPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatBreakdownDecimal(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBreakdownCurrency(value: number, currency: string | null, compact: boolean): string {
  if (compact) {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return formatMetaMetricValue("spend", value, currency);
}

export function formatBreakdownDisplay(
  metric: BreakdownMetricKey,
  value: number,
  currency: string | null,
  compact: boolean,
): string {
  const kind = breakdownMetricKind(metric);
  if (kind === "percent") return formatBreakdownPercent(value);
  if (kind === "decimal") return formatBreakdownDecimal(value);
  if (kind === "currency") return formatBreakdownCurrency(value, currency, compact);
  return compact ? formatBreakdownCompact(value) : formatBreakdownAxis(value);
}

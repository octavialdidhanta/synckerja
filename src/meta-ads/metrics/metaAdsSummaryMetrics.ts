import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsAccountSummary } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  getMetaAdsMetricsForEntity,
  isMetaAdsSynckerjaMetricKey,
  META_ADS_SUMMARY_EXCLUDED_METRIC_KEYS,
  type MetaAdsMetricCatalogItem,
} from "@/meta-ads/metrics/metaAdsMetricCatalog";
import {
  computeSummaryCtr,
  computeSummaryCpc,
  formatMetaCtr,
  formatMetaMetricValue,
  parseMetricNumber,
} from "@/meta-ads/metrics/formatMetaMetricValue";

/** Metrics available as table columns (catalog + campaign service columns). */
export type MetaAdsTableMetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "reach"
  | "frequency"
  | "content_views"
  | "click_to_view_rate"
  | "adds_to_cart"
  | "view_to_atc_rate"
  | "cost_per_atc"
  | "atc_conversion_value"
  | "purchases"
  | "atc_to_purchase_rate"
  | "purchase_conversion_value"
  | "aov"
  | "cost_per_purchase"
  | "purchase_roas"
  | "service_cpl"
  | "service_converted_leads";

export type MetaAdsSummaryMetricOption = {
  key: MetaAdsTableMetricKey;
  label: string;
  groupId: "performance" | "attribution";
  groupLabel: string;
};

export const META_ADS_SUMMARY_SLOT_COUNT = 5;

export const META_ADS_SUMMARY_DEFAULT_SLOT_KEYS: MetaAdsTableMetricKey[] = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
];

/** Cost, Impressions, CPM, CPC, CTR, Link clicks — CPAS summary uses four of these. */
export const META_ADS_CPAS_SUMMARY_CLUSTER_KEYS = [
  "impressions",
  "cpm",
  "cpc",
  "ctr",
  "clicks",
] as const;

/** Link clicks through ATC conversion value — the other CPAS summary uses four of these. */
export const META_ADS_CPAS_FUNNEL_SUMMARY_CLUSTER_KEYS = [
  "clicks",
  "click_to_view_rate",
  "content_views",
  "view_to_atc_rate",
  "adds_to_cart",
  "atc_conversion_value",
] as const;

export const META_ADS_CPAS_SUMMARY_SLOT_COUNT = 4;

export const META_ADS_CPAS_SUMMARY_DEFAULT_SLOT_KEYS: MetaAdsTableMetricKey[] = [
  "spend",
  "impressions",
  "cpm",
  "ctr",
];

export const META_ADS_CPAS_FUNNEL_SUMMARY_DEFAULT_SLOT_KEYS: MetaAdsTableMetricKey[] = [
  "spend",
  "click_to_view_rate",
  "view_to_atc_rate",
  "atc_conversion_value",
];

/** Adds to cart through AOV — purchase CPAS summary uses four of these. */
export const META_ADS_CPAS_PURCHASE_SUMMARY_CLUSTER_KEYS = [
  "adds_to_cart",
  "atc_to_purchase_rate",
  "purchases",
  "purchase_conversion_value",
  "cost_per_purchase",
  "aov",
] as const;

export const META_ADS_CPAS_PURCHASE_SUMMARY_DEFAULT_SLOT_KEYS: MetaAdsTableMetricKey[] = [
  "atc_to_purchase_rate",
  "purchase_conversion_value",
  "cost_per_purchase",
  "aov",
];

function columnSetHasEveryKey(metricKeys: readonly string[], required: readonly string[]): boolean {
  const selected = new Set(metricKeys);
  return required.every((key) => selected.has(key));
}

export function isMetaAdsCpasSummaryColumnSet(metricKeys: readonly string[]): boolean {
  return columnSetHasEveryKey(metricKeys, META_ADS_CPAS_SUMMARY_CLUSTER_KEYS);
}

export function isMetaAdsCpasFunnelSummaryColumnSet(metricKeys: readonly string[]): boolean {
  return columnSetHasEveryKey(metricKeys, META_ADS_CPAS_FUNNEL_SUMMARY_CLUSTER_KEYS);
}

export function isMetaAdsCpasPurchaseSummaryColumnSet(metricKeys: readonly string[]): boolean {
  return columnSetHasEveryKey(metricKeys, META_ADS_CPAS_PURCHASE_SUMMARY_CLUSTER_KEYS);
}

function cpasSummaryDefaultsForSlots(keys: readonly string[]): MetaAdsTableMetricKey[] | null {
  if (keys.length !== META_ADS_CPAS_SUMMARY_SLOT_COUNT) return null;
  const selected = new Set(keys);
  const candidates = [
    META_ADS_CPAS_PURCHASE_SUMMARY_DEFAULT_SLOT_KEYS,
    META_ADS_CPAS_FUNNEL_SUMMARY_DEFAULT_SLOT_KEYS,
    META_ADS_CPAS_SUMMARY_DEFAULT_SLOT_KEYS,
  ];
  let best = META_ADS_CPAS_SUMMARY_DEFAULT_SLOT_KEYS;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = candidate.filter((key) => selected.has(key)).length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

const CAMPAIGN_ONLY_KEYS = new Set<MetaAdsTableMetricKey>([
  "service_cpl",
  "service_converted_leads",
]);

export type MetaAdsSummaryTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number | null;
  currency: string;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  contentViews: number | null;
  clickToViewRate: number | null;
  addsToCart: number | null;
  viewToAtcRate: number | null;
  costPerAtc: number | null;
  atcConversionValue: number | null;
  purchases: number | null;
  atcToPurchaseRate: number | null;
  purchaseConversionValue: number | null;
  aov: number | null;
  costPerPurchase: number | null;
  purchaseRoas: number | null;
  convertedLeads: number | null;
  cpa: number | null;
};

function computeSummaryCpm(spend: number, impressions: number): number | null {
  if (impressions <= 0 || !Number.isFinite(spend)) return null;
  return (spend / impressions) * 1000;
}

function aggregateCampaignAttribution(rows: MetaAdsMetricsRow[]): {
  convertedLeads: number;
  hasLeads: boolean;
} {
  let convertedLeads = 0;
  let hasLeads = false;
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const n = parseMetricNumber(r.service_converted_leads);
    if (n != null && n > 0) {
      convertedLeads += n;
      hasLeads = true;
    }
  }
  return { convertedLeads, hasLeads };
}

function summaryMetricNumber(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

export function buildMetaAdsSummaryTotals(
  summary: MetaAdsAccountSummary | null | undefined,
  rows: MetaAdsMetricsRow[],
  entity: MetaAdsMetricEntity,
): MetaAdsSummaryTotals | null {
  if (!summary) return null;

  const spend = summary.spend ?? 0;
  const impressions = summary.impressions ?? 0;
  const clicks = summary.clicks ?? 0;
  const reachRaw = summary.reach;
  const reach =
    reachRaw != null && Number.isFinite(reachRaw) ? reachRaw : null;

  const attribution =
    entity === "campaign" ? aggregateCampaignAttribution(rows) : { convertedLeads: 0, hasLeads: false };

  const cpa =
    attribution.hasLeads && attribution.convertedLeads > 0 ? spend / attribution.convertedLeads : null;

  return {
    spend,
    impressions,
    clicks,
    reach,
    currency: summary.currency ?? "IDR",
    ctr: computeSummaryCtr(clicks, impressions),
    cpc: computeSummaryCpc(spend, clicks),
    cpm: computeSummaryCpm(spend, impressions),
    frequency: summaryMetricNumber(summary.frequency),
    contentViews: summaryMetricNumber(summary.content_views),
    clickToViewRate: summaryMetricNumber(summary.click_to_view_rate),
    addsToCart: summaryMetricNumber(summary.adds_to_cart),
    viewToAtcRate: summaryMetricNumber(summary.view_to_atc_rate),
    costPerAtc: summaryMetricNumber(summary.cost_per_atc),
    atcConversionValue: summaryMetricNumber(summary.atc_conversion_value),
    purchases: summaryMetricNumber(summary.purchases),
    atcToPurchaseRate: summaryMetricNumber(summary.atc_to_purchase_rate),
    purchaseConversionValue: summaryMetricNumber(summary.purchase_conversion_value),
    aov: summaryMetricNumber(summary.aov),
    costPerPurchase: summaryMetricNumber(summary.cost_per_purchase),
    purchaseRoas: summaryMetricNumber(summary.purchase_roas),
    convertedLeads: attribution.hasLeads ? attribution.convertedLeads : null,
    cpa,
  };
}

export function metaAdsSummaryValidKeys(entity: MetaAdsMetricEntity): MetaAdsTableMetricKey[] {
  const excluded = new Set<string>(META_ADS_SUMMARY_EXCLUDED_METRIC_KEYS);
  const keys = getMetaAdsMetricsForEntity(entity)
    .filter((m) => !isMetaAdsSynckerjaMetricKey(m.key) && !excluded.has(m.key))
    .map((m) => m.key as MetaAdsTableMetricKey);
  if (entity === "campaign") {
    keys.push("service_cpl", "service_converted_leads");
  }
  return keys;
}

/** First summary cards follow the chosen column-set order. Delivery and budget stay in the table only. */
export function summarySlotKeysFromMetricKeys(
  metricKeys: string[],
  entity: MetaAdsMetricEntity,
): MetaAdsTableMetricKey[] {
  if (isMetaAdsCpasSummaryColumnSet(metricKeys)) {
    return [...META_ADS_CPAS_SUMMARY_DEFAULT_SLOT_KEYS];
  }
  if (isMetaAdsCpasFunnelSummaryColumnSet(metricKeys)) {
    return [...META_ADS_CPAS_FUNNEL_SUMMARY_DEFAULT_SLOT_KEYS];
  }
  if (isMetaAdsCpasPurchaseSummaryColumnSet(metricKeys)) {
    return [...META_ADS_CPAS_PURCHASE_SUMMARY_DEFAULT_SLOT_KEYS];
  }
  const valid = new Set(metaAdsSummaryValidKeys(entity));
  const picked: MetaAdsTableMetricKey[] = [];
  const seen = new Set<string>();
  for (const raw of metricKeys) {
    if (picked.length >= META_ADS_SUMMARY_SLOT_COUNT) break;
    const key = String(raw ?? "").trim();
    if (!key || seen.has(key) || !valid.has(key as MetaAdsTableMetricKey)) continue;
    seen.add(key);
    picked.push(key as MetaAdsTableMetricKey);
  }
  for (const fallback of META_ADS_SUMMARY_DEFAULT_SLOT_KEYS) {
    if (picked.length >= META_ADS_SUMMARY_SLOT_COUNT) break;
    if (seen.has(fallback) || !valid.has(fallback)) continue;
    seen.add(fallback);
    picked.push(fallback);
  }
  return normalizeMetaAdsSummarySlotKeys(picked, valid, entity);
}

export function buildMetaAdsSummaryMetricOptions(args: {
  entity: MetaAdsMetricEntity;
  catalogItems: MetaAdsMetricCatalogItem[];
  labels: {
    performance: string;
    attribution: string;
    spend: string;
    impressions: string;
    clicks: string;
    ctr: string;
    cpc: string;
    cpm: string;
    reach: string;
    cpa: string;
    convertedLeads: string;
  };
}): MetaAdsSummaryMetricOption[] {
  const options: MetaAdsSummaryMetricOption[] = [];

  const excluded = new Set<string>(META_ADS_SUMMARY_EXCLUDED_METRIC_KEYS);
  for (const item of args.catalogItems) {
    if (isMetaAdsSynckerjaMetricKey(item.key) || excluded.has(item.key)) continue;
    const key = item.key as MetaAdsTableMetricKey;
    options.push({
      key,
      label:
        key === "spend"
          ? args.labels.spend
          : key === "impressions"
            ? args.labels.impressions
            : key === "clicks"
              ? args.labels.clicks
              : key === "ctr"
                ? args.labels.ctr
                : key === "cpc"
                  ? args.labels.cpc
                  : key === "cpm"
                    ? args.labels.cpm
                    : key === "reach"
                      ? args.labels.reach
                      : item.defaultLabel,
      groupId: "performance",
      groupLabel: args.labels.performance,
    });
  }

  if (args.entity === "campaign") {
    options.push(
      {
        key: "service_cpl",
        label: args.labels.cpa,
        groupId: "attribution",
        groupLabel: args.labels.attribution,
      },
      {
        key: "service_converted_leads",
        label: args.labels.convertedLeads,
        groupId: "attribution",
        groupLabel: args.labels.attribution,
      },
    );
  }

  return options;
}

export function metaAdsSummaryMetricGroups(
  options: MetaAdsSummaryMetricOption[],
): { id: string; label: string; options: MetaAdsSummaryMetricOption[] }[] {
  const byGroup = new Map<string, MetaAdsSummaryMetricOption[]>();
  for (const opt of options) {
    const list = byGroup.get(opt.groupId) ?? [];
    list.push(opt);
    byGroup.set(opt.groupId, list);
  }
  const order: Array<"performance" | "attribution"> = ["performance", "attribution"];
  return order
    .filter((id) => byGroup.has(id))
    .map((id) => ({
      id,
      label: byGroup.get(id)![0]!.groupLabel,
      options: byGroup.get(id)!,
    }));
}

export function findMetaAdsSummaryMetricOption(
  key: string,
  options: MetaAdsSummaryMetricOption[],
): MetaAdsSummaryMetricOption | undefined {
  return options.find((o) => o.key === key);
}

export function formatMetaAdsSummaryMetricValue(
  key: MetaAdsTableMetricKey,
  totals: MetaAdsSummaryTotals | null,
): string {
  if (!totals) return "—";

  switch (key) {
    case "spend":
      return formatMetaMetricValue("spend", totals.spend, totals.currency);
    case "impressions":
      return formatMetaMetricValue("impressions", totals.impressions, totals.currency);
    case "clicks":
      return formatMetaMetricValue("clicks", totals.clicks, totals.currency);
    case "reach":
      if (totals.reach == null) return "—";
      return formatMetaMetricValue("reach", totals.reach, totals.currency);
    case "ctr":
      return formatMetaCtr(totals.ctr, "computed");
    case "cpc":
      return formatMetaMetricValue("cpc", totals.cpc, totals.currency);
    case "cpm":
      return formatMetaMetricValue("cpm", totals.cpm, totals.currency);
    case "frequency":
      return formatMetaMetricValue("frequency", totals.frequency, totals.currency);
    case "content_views":
      return formatMetaMetricValue("content_views", totals.contentViews, totals.currency);
    case "click_to_view_rate":
      return formatMetaMetricValue("click_to_view_rate", totals.clickToViewRate, totals.currency);
    case "adds_to_cart":
      return formatMetaMetricValue("adds_to_cart", totals.addsToCart, totals.currency);
    case "view_to_atc_rate":
      return formatMetaMetricValue("view_to_atc_rate", totals.viewToAtcRate, totals.currency);
    case "cost_per_atc":
      return formatMetaMetricValue("cost_per_atc", totals.costPerAtc, totals.currency);
    case "atc_conversion_value":
      return formatMetaMetricValue("atc_conversion_value", totals.atcConversionValue, totals.currency);
    case "purchases":
      return formatMetaMetricValue("purchases", totals.purchases, totals.currency);
    case "atc_to_purchase_rate":
      return formatMetaMetricValue("atc_to_purchase_rate", totals.atcToPurchaseRate, totals.currency);
    case "purchase_conversion_value":
      return formatMetaMetricValue(
        "purchase_conversion_value",
        totals.purchaseConversionValue,
        totals.currency,
      );
    case "aov":
      return formatMetaMetricValue("aov", totals.aov, totals.currency);
    case "cost_per_purchase":
      return formatMetaMetricValue("cost_per_purchase", totals.costPerPurchase, totals.currency);
    case "purchase_roas":
      return formatMetaMetricValue("purchase_roas", totals.purchaseRoas, totals.currency);
    case "service_converted_leads":
      if (totals.convertedLeads == null) return "—";
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
        totals.convertedLeads,
      );
    case "service_cpl":
      return formatMetaMetricValue("spend", totals.cpa, totals.currency);
    default:
      return "—";
  }
}

/** Numeric value used for period compare — same source as the formatted card value. */
export function metaAdsSummaryNumericValue(
  key: MetaAdsTableMetricKey,
  totals: MetaAdsSummaryTotals | null | undefined,
): number | null {
  if (!totals) return null;
  switch (key) {
    case "spend":
      return Number.isFinite(totals.spend) ? totals.spend : null;
    case "impressions":
      return Number.isFinite(totals.impressions) ? totals.impressions : null;
    case "clicks":
      return Number.isFinite(totals.clicks) ? totals.clicks : null;
    case "reach":
      return totals.reach;
    case "ctr":
      return totals.ctr;
    case "cpc":
      return totals.cpc;
    case "cpm":
      return totals.cpm;
    case "frequency":
      return totals.frequency;
    case "content_views":
      return totals.contentViews;
    case "click_to_view_rate":
      return totals.clickToViewRate;
    case "adds_to_cart":
      return totals.addsToCart;
    case "view_to_atc_rate":
      return totals.viewToAtcRate;
    case "cost_per_atc":
      return totals.costPerAtc;
    case "atc_conversion_value":
      return totals.atcConversionValue;
    case "purchases":
      return totals.purchases;
    case "atc_to_purchase_rate":
      return totals.atcToPurchaseRate;
    case "purchase_conversion_value":
      return totals.purchaseConversionValue;
    case "aov":
      return totals.aov;
    case "cost_per_purchase":
      return totals.costPerPurchase;
    case "purchase_roas":
      return totals.purchaseRoas;
    case "service_converted_leads":
      return totals.convertedLeads;
    case "service_cpl":
      return totals.cpa;
    default:
      return null;
  }
}

export function metaAdsCompareToneKey(key: MetaAdsTableMetricKey): string {
  if (key === "spend") return "spent";
  if (key === "service_cpl") return "cpa";
  return key;
}

export function normalizeMetaAdsSummarySlotKeys(
  keys: string[],
  validKeys: Iterable<MetaAdsTableMetricKey>,
  entity: MetaAdsMetricEntity,
): MetaAdsTableMetricKey[] {
  const cpasDefaults = cpasSummaryDefaultsForSlots(keys);
  const cpasSlots = cpasDefaults != null;
  const slotCount = cpasSlots ? META_ADS_CPAS_SUMMARY_SLOT_COUNT : META_ADS_SUMMARY_SLOT_COUNT;
  const defaults = cpasDefaults ?? META_ADS_SUMMARY_DEFAULT_SLOT_KEYS;
  const valid = new Set(validKeys);
  const result: MetaAdsTableMetricKey[] = [];
  for (let i = 0; i < slotCount; i++) {
    const fallback = defaults[i] ?? "spend";
    const key = keys[i];
    if (key && valid.has(key as MetaAdsTableMetricKey)) {
      const k = key as MetaAdsTableMetricKey;
      if (entity !== "campaign" && CAMPAIGN_ONLY_KEYS.has(k)) {
        result.push(fallback);
      } else {
        result.push(k);
      }
    } else {
      result.push(fallback);
    }
  }
  return result;
}

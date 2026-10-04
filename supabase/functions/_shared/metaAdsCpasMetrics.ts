/** CPAS shared-item metrics and the calculated columns from the Ads Manager preset. */

export type CpasCounts = {
  contentViews: number;
  addsToCart: number;
  purchases: number;
  atcConversionValue: number;
  purchaseConversionValue: number;
};

export type CpasFields = {
  content_views: number;
  adds_to_cart: number;
  purchases: number;
  atc_conversion_value: number;
  purchase_conversion_value: number;
  click_to_view_rate: number | null;
  view_to_atc_rate: number | null;
  atc_to_purchase_rate: number | null;
  cost_per_atc: number | null;
  cost_per_purchase: number | null;
  aov: number | null;
  purchase_roas: number | null;
  frequency: number | null;
};

const VIEW_CONTENT_TYPES = ["omni_view_content", "view_content"] as const;
const ADD_TO_CART_TYPES = ["omni_add_to_cart", "add_to_cart"] as const;
const PURCHASE_TYPES = ["omni_purchase", "purchase"] as const;

/** Meta currencies whose budget offset is 1. IDR is in this set. */
const OFFSET_ONE_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "IDR",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

type ActionStat = { action_type?: string; value?: unknown };

export function emptyCpasCounts(): CpasCounts {
  return {
    contentViews: 0,
    addsToCart: 0,
    purchases: 0,
    atcConversionValue: 0,
    purchaseConversionValue: 0,
  };
}

export function parseMetaNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseCount(value: unknown): number {
  return Math.round(parseMetaNumber(value));
}

function actionStats(value: unknown): ActionStat[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as ActionStat[];
}

/** First matching action type wins, so omni is not added on top of website. */
function pickAction(actions: unknown, types: readonly string[], asCount: boolean): number {
  const list = actionStats(actions);
  for (const type of types) {
    const hit = list.find((row) => String(row.action_type ?? "") === type);
    if (hit) return asCount ? parseCount(hit.value) : parseMetaNumber(hit.value);
  }
  return 0;
}

export function readCpasCounts(row: {
  catalog_segment_actions?: unknown;
  catalog_segment_value?: unknown;
}): CpasCounts {
  return {
    contentViews: pickAction(row.catalog_segment_actions, VIEW_CONTENT_TYPES, true),
    addsToCart: pickAction(row.catalog_segment_actions, ADD_TO_CART_TYPES, true),
    purchases: pickAction(row.catalog_segment_actions, PURCHASE_TYPES, true),
    atcConversionValue: pickAction(row.catalog_segment_value, ADD_TO_CART_TYPES, false),
    purchaseConversionValue: pickAction(row.catalog_segment_value, PURCHASE_TYPES, false),
  };
}

export function readStoredCpasCounts(row: Record<string, unknown>): CpasCounts {
  return {
    contentViews: parseCount(row.content_views),
    addsToCart: parseCount(row.adds_to_cart),
    purchases: parseCount(row.purchases),
    atcConversionValue: parseMetaNumber(row.atc_conversion_value),
    purchaseConversionValue: parseMetaNumber(row.purchase_conversion_value),
  };
}

export function addCpasCounts(left: CpasCounts, right: CpasCounts): CpasCounts {
  return {
    contentViews: left.contentViews + right.contentViews,
    addsToCart: left.addsToCart + right.addsToCart,
    purchases: left.purchases + right.purchases,
    atcConversionValue: left.atcConversionValue + right.atcConversionValue,
    purchaseConversionValue: left.purchaseConversionValue + right.purchaseConversionValue,
  };
}

export function ratePercent(numerator: number, denominator: number): number | null {
  if (!(denominator > 0) || !Number.isFinite(numerator)) return null;
  return (numerator / denominator) * 100;
}

export function safeDivide(numerator: number, denominator: number): number | null {
  if (!(denominator > 0) || !Number.isFinite(numerator)) return null;
  return numerator / denominator;
}

export function deriveCpasFields(args: {
  counts: CpasCounts;
  spend: number;
  linkClicks: number;
  impressions: number;
  reach: number;
  /** Meta's own frequency. Null recomputes impressions / reach (used when date chunks are merged). */
  frequency?: number | null;
}): CpasFields {
  const { counts, spend, linkClicks, impressions, reach } = args;
  const apiFrequency = args.frequency;
  const frequency =
    apiFrequency != null && apiFrequency > 0
      ? apiFrequency
      : safeDivide(impressions, reach);

  return {
    content_views: counts.contentViews,
    adds_to_cart: counts.addsToCart,
    purchases: counts.purchases,
    atc_conversion_value: counts.atcConversionValue,
    purchase_conversion_value: counts.purchaseConversionValue,
    click_to_view_rate: ratePercent(counts.contentViews, linkClicks),
    view_to_atc_rate: ratePercent(counts.addsToCart, counts.contentViews),
    atc_to_purchase_rate: ratePercent(counts.purchases, counts.addsToCart),
    cost_per_atc: safeDivide(spend, counts.addsToCart),
    cost_per_purchase: safeDivide(spend, counts.purchases),
    aov: safeDivide(counts.purchaseConversionValue, counts.purchases),
    purchase_roas: safeDivide(counts.purchaseConversionValue, spend),
    frequency,
  };
}

function optionalPositive(value: unknown): number | null {
  const n = parseMetaNumber(value);
  return n > 0 ? n : null;
}

/** Writes flat CPAS fields onto an insights row. Safe to call again after the raw lists are removed. */
export function applyCpasMetrics(
  row: Record<string, unknown>,
  options?: { recomputeFrequency?: boolean },
): void {
  const hasLists =
    Array.isArray(row.catalog_segment_actions) || Array.isArray(row.catalog_segment_value);
  const counts = hasLists ? readCpasCounts(row) : readStoredCpasCounts(row);
  const fields = deriveCpasFields({
    counts,
    spend: parseMetaNumber(row.spend),
    linkClicks: parseCount(row.clicks),
    impressions: parseCount(row.impressions),
    reach: parseCount(row.reach),
    frequency: options?.recomputeFrequency ? null : optionalPositive(row.frequency),
  });
  Object.assign(row, fields);
  delete row.catalog_segment_actions;
  delete row.catalog_segment_value;
}

export function currencyOffset(currency: string | null | undefined): number {
  const code = String(currency ?? "").trim().toUpperCase();
  if (OFFSET_ONE_CURRENCIES.has(code)) return 1;
  return 100;
}

/** Daily budget when set, otherwise lifetime. Meta returns the minor unit. */
export function pickBudget(
  daily: unknown,
  lifetime: unknown,
  currency: string | null | undefined,
): number | null {
  const raw = parseMetaNumber(daily) > 0 ? parseMetaNumber(daily) : parseMetaNumber(lifetime);
  if (!(raw > 0)) return null;
  return raw / currencyOffset(currency);
}

export type DeliveryLabel = "Active" | "Off" | "Learning" | "Learning limited";

/** Ads Manager shows Learning while the ad set is still in the learning phase. */
export function deliveryLabel(status: unknown, learningStatus?: unknown): DeliveryLabel | null {
  const learning = String(learningStatus ?? "").trim().toUpperCase();
  if (learning === "LEARNING") return "Learning";
  if (learning === "FAIL") return "Learning limited";
  const value = String(status ?? "").trim().toUpperCase();
  if (!value) return null;
  return value === "ACTIVE" ? "Active" : "Off";
}

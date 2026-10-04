import type {
  MetaAdsAccountSummary,
  MetaAdsMetricEntity,
  MetaAdsMetricsRow,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";

export type MetaAdsParentOption = {
  id: string;
  name: string;
};

function rowText(row: MetaAdsMetricsRow, field: string): string {
  return String(row[field] ?? "").trim();
}

function rowNumber(row: MetaAdsMetricsRow, field: string): number {
  const value = row[field];
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowOptionalNumber(row: MetaAdsMetricsRow, field: string): number | null {
  const value = row[field];
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function byName(a: MetaAdsParentOption, b: MetaAdsParentOption): number {
  return a.name.localeCompare(b.name);
}

/** Campaigns that have at least one ad set in the current result. */
export function metaAdsCampaignOptions(rows: MetaAdsMetricsRow[]): MetaAdsParentOption[] {
  const names = new Map<string, string>();
  for (const row of rows) {
    const id = rowText(row, "campaign_id");
    if (!id || names.has(id)) continue;
    names.set(id, rowText(row, "campaign_name") || id);
  }
  return [...names.entries()].map(([id, name]) => ({ id, name })).sort(byName);
}

const RUNNING_ADSET_DELIVERY = new Set(["Active", "Learning", "Learning limited"]);

/** Running ad sets of the chosen campaign, including those still in learning. */
export function metaAdsActiveAdsetOptions(
  adsetRows: MetaAdsMetricsRow[],
  campaignId: string | null,
): MetaAdsParentOption[] {
  if (!campaignId) return [];
  const names = new Map<string, string>();
  for (const row of adsetRows) {
    if (rowText(row, "campaign_id") !== campaignId) continue;
    if (!RUNNING_ADSET_DELIVERY.has(rowText(row, "delivery"))) continue;
    const id = rowText(row, "adset_id");
    if (!id || names.has(id)) continue;
    names.set(id, rowText(row, "adset_name") || id);
  }
  return [...names.entries()].map(([id, name]) => ({ id, name })).sort(byName);
}

export function filterMetaAdsRowsByParent(args: {
  entity: MetaAdsMetricEntity;
  rows: MetaAdsMetricsRow[];
  campaignId: string | null;
  adsetId: string | null;
  activeAdsetIds: string[];
}): MetaAdsMetricsRow[] {
  const { entity, rows, campaignId, adsetId, activeAdsetIds } = args;
  if (!campaignId) return rows;
  if (entity === "adset") {
    return rows.filter((row) => rowText(row, "campaign_id") === campaignId);
  }
  if (entity === "ad") {
    if (adsetId) return rows.filter((row) => rowText(row, "adset_id") === adsetId);
    const allowed = new Set(activeAdsetIds);
    return rows.filter((row) => allowed.has(rowText(row, "adset_id")));
  }
  return rows;
}

/** One campaign insight row, including unique reach. Used for the ad set cards. */
export function summaryFromMetaAdsRow(
  row: MetaAdsMetricsRow,
  currency: string,
): MetaAdsAccountSummary {
  return {
    spend: rowNumber(row, "spend"),
    impressions: rowNumber(row, "impressions"),
    clicks: rowNumber(row, "clicks"),
    reach: rowNumber(row, "reach"),
    currency,
    content_views: rowNumber(row, "content_views"),
    adds_to_cart: rowNumber(row, "adds_to_cart"),
    purchases: rowNumber(row, "purchases"),
    atc_conversion_value: rowNumber(row, "atc_conversion_value"),
    purchase_conversion_value: rowNumber(row, "purchase_conversion_value"),
    click_to_view_rate: rowOptionalNumber(row, "click_to_view_rate"),
    view_to_atc_rate: rowOptionalNumber(row, "view_to_atc_rate"),
    atc_to_purchase_rate: rowOptionalNumber(row, "atc_to_purchase_rate"),
    cost_per_atc: rowOptionalNumber(row, "cost_per_atc"),
    cost_per_purchase: rowOptionalNumber(row, "cost_per_purchase"),
    aov: rowOptionalNumber(row, "aov"),
    purchase_roas: rowOptionalNumber(row, "purchase_roas"),
    frequency: rowOptionalNumber(row, "frequency"),
  };
}

/** Keep spend and conversions from the child rows, but use the parent's unique reach. */
export function applyParentReach(
  summary: MetaAdsAccountSummary,
  parent: MetaAdsMetricsRow | null | undefined,
): MetaAdsAccountSummary {
  if (!parent) return summary;
  const reach = rowOptionalNumber(parent, "reach");
  const frequency = rowOptionalNumber(parent, "frequency");
  if (reach == null && frequency == null) return summary;
  return {
    ...summary,
    ...(reach != null ? { reach } : {}),
    ...(frequency != null ? { frequency } : {}),
  };
}

/** Account-style totals for the rows left after a campaign or ad set filter. */
export function summarizeMetaAdsFilteredRows(
  rows: MetaAdsMetricsRow[],
  currency: string,
): MetaAdsAccountSummary {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let reach = 0;
  let contentViews = 0;
  let addsToCart = 0;
  let purchases = 0;
  let atcValue = 0;
  let purchaseValue = 0;
  for (const row of rows) {
    spend += rowNumber(row, "spend");
    impressions += rowNumber(row, "impressions");
    clicks += rowNumber(row, "clicks");
    reach += rowNumber(row, "reach");
    contentViews += rowNumber(row, "content_views");
    addsToCart += rowNumber(row, "adds_to_cart");
    purchases += rowNumber(row, "purchases");
    atcValue += rowNumber(row, "atc_conversion_value");
    purchaseValue += rowNumber(row, "purchase_conversion_value");
  }
  const rate = (numerator: number, divisor: number) =>
    divisor > 0 ? (numerator / divisor) * 100 : null;
  return {
    spend,
    impressions,
    clicks,
    reach,
    currency,
    content_views: contentViews,
    adds_to_cart: addsToCart,
    purchases,
    atc_conversion_value: atcValue,
    purchase_conversion_value: purchaseValue,
    click_to_view_rate: rate(contentViews, clicks),
    view_to_atc_rate: rate(addsToCart, contentViews),
    atc_to_purchase_rate: rate(purchases, addsToCart),
    cost_per_atc: addsToCart > 0 ? spend / addsToCart : null,
    cost_per_purchase: purchases > 0 ? spend / purchases : null,
    aov: purchases > 0 ? purchaseValue / purchases : null,
    purchase_roas: spend > 0 ? purchaseValue / spend : null,
    frequency: reach > 0 ? impressions / reach : null,
  };
}

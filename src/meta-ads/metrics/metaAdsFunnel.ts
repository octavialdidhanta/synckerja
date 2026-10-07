import type {
  MetaAdsAccountSummary,
  MetaAdsMetricEntity,
  MetaAdsMetricsRow,
} from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { getMetaAdsMetricsForEntity } from "@/meta-ads/metrics/metaAdsMetricCatalog";
import { parseMetricNumber } from "@/meta-ads/metrics/formatMetaMetricValue";
import {
  summarizeMetaAdsFilteredRows,
  summaryFromMetaAdsRow,
  uniqueMetaAdsIds,
} from "@/meta-ads/metrics/metaAdsParentFilters";

export const META_ADS_FUNNEL_SLOT_COUNT = 4;

export const META_ADS_FUNNEL_DEFAULT_KEYS = [
  "impressions",
  "clicks",
  "adds_to_cart",
  "purchases",
] as const;

export function metaAdsFunnelMetricOptions() {
  return getMetaAdsMetricsForEntity("ad").filter(
    (metric) => metric.valueKind !== "text" && metric.key !== "budget",
  );
}

/** Ads win over ad sets, and ad sets win over campaigns. */
export function resolveMetaAdsFunnelLevel(args: {
  campaignIds: readonly string[];
  adsetIds: readonly string[];
  adIds: readonly string[];
}): MetaAdsMetricEntity {
  if (args.adIds.length > 0) return "ad";
  if (args.adsetIds.length > 0) return "adset";
  return "campaign";
}

function rowId(row: MetaAdsMetricsRow, field: string): string {
  return String(row[field] ?? "").trim();
}

function summaryForIds(
  rows: MetaAdsMetricsRow[],
  field: string,
  ids: readonly string[],
  currency: string,
): MetaAdsAccountSummary {
  const allowed = new Set(uniqueMetaAdsIds(ids));
  const selected = rows.filter((row) => allowed.has(rowId(row, field)));
  if (selected.length === 1) return summaryFromMetaAdsRow(selected[0], currency);
  return summarizeMetaAdsFilteredRows(selected, currency);
}

/** Account summary when nothing is checked. Otherwise the checked rows at the deepest level. */
export function buildMetaAdsFunnelSummary(args: {
  rows: MetaAdsMetricsRow[];
  accountSummary: MetaAdsAccountSummary | null | undefined;
  campaignIds: readonly string[];
  adsetIds: readonly string[];
  adIds: readonly string[];
}): MetaAdsAccountSummary | null {
  const currency = args.accountSummary?.currency ?? "IDR";
  if (args.adIds.length > 0) return summaryForIds(args.rows, "ad_id", args.adIds, currency);
  if (args.adsetIds.length > 0) return summaryForIds(args.rows, "adset_id", args.adsetIds, currency);
  if (args.campaignIds.length > 0) {
    return summaryForIds(args.rows, "campaign_id", args.campaignIds, currency);
  }
  return args.accountSummary ?? null;
}

/** Purchase value divided by spend. Uses the stored ratio, then the two totals. */
export function readMetaAdsPurchaseRoas(
  summary: MetaAdsAccountSummary | null | undefined,
): number | null {
  const direct = readMetaAdsFunnelMetric(summary, "purchase_roas");
  if (direct != null) return direct;
  if (!summary || summary.spend <= 0) return null;
  const value = parseMetricNumber(summary.purchase_conversion_value);
  if (value == null) return null;
  return value / summary.spend;
}

export function readMetaAdsFunnelMetric(
  summary: MetaAdsAccountSummary | null | undefined,
  key: string,
): number | null {
  if (!summary) return null;
  if (key === "ctr") {
    return summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : null;
  }
  if (key === "cpc") {
    return summary.clicks > 0 ? summary.spend / summary.clicks : null;
  }
  if (key === "cpm") {
    return summary.impressions > 0 ? (summary.spend / summary.impressions) * 1000 : null;
  }
  const raw = (summary as Record<string, unknown>)[key];
  return parseMetricNumber(raw);
}

export type MetaAdsFunnelStep = {
  /** Bar height as a share of the largest count, so column order does not inflate a stage. */
  height: number;
  /** Percent of the largest count. Empty on the largest stage itself. */
  rate: number | null;
  /** How many fewer than the previous column, when this count is smaller. */
  belowPrevious: number | null;
};

/** Bars compare raw counts. The tallest count is 100%, wherever it sits. */
export function metaAdsFunnelSteps(
  values: Array<number | null>,
  countFlags: readonly boolean[],
): MetaAdsFunnelStep[] {
  let max = 0;
  let maxIndex = -1;
  values.forEach((value, index) => {
    if (countFlags[index] === true && value != null && value > max) {
      max = value;
      maxIndex = index;
    }
  });
  return values.map((value, index) => {
    const hasValue = value != null && value !== 0;
    const previous = index > 0 ? values[index - 1] : null;
    const belowPrevious =
      countFlags[index] === true &&
      countFlags[index - 1] === true &&
      previous != null &&
      value != null &&
      value < previous
        ? previous - value
        : null;
    if (max <= 0 || countFlags[index] !== true || value == null) {
      return { height: hasValue ? 100 : 0, rate: null, belowPrevious };
    }
    const share = (value / max) * 100;
    return {
      height: Math.max(0, Math.min(100, share)),
      rate: index === maxIndex ? null : share,
      belowPrevious,
    };
  });
}

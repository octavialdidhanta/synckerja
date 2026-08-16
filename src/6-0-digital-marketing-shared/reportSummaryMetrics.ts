import { computeSummaryCpc, computeSummaryCtr, formatMetaCtr } from "@/meta-ads/metrics/formatMetaMetricValue";
import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import { formatMetaMetricValue } from "@/meta-ads/metrics/formatMetaMetricValue";
import type {
  ReportChannelCost,
  ReportGoogleServiceRow,
  ReportMetaServiceRow,
  ReportTikTokServiceRow,
} from "@/6-0-digital-marketing-shared/hooks/useDigitalMarketingReportCosts";
import { DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY } from "@/6-0-digital-marketing-shared/reportDisplayCurrency";

/** Metrics available as table columns (excludes channel, service, status, account). */
export type ReportTableMetricKey =
  | "cost"
  | "cpa"
  | "converted_leads"
  | "impressions"
  | "ctr"
  | "clicks"
  | "cpc";

export type ReportSummaryMetricOption = {
  key: ReportTableMetricKey;
  label: string;
  groupId: "performance";
  groupLabel: string;
};

export const REPORT_SUMMARY_METRIC_OPTIONS: ReportSummaryMetricOption[] = [
  { key: "cost", label: "Cost", groupId: "performance", groupLabel: "Performance" },
  { key: "cpc", label: "CPC", groupId: "performance", groupLabel: "Performance" },
  { key: "cpa", label: "CPA", groupId: "performance", groupLabel: "Performance" },
  {
    key: "converted_leads",
    label: "Conv. leads",
    groupId: "performance",
    groupLabel: "Performance",
  },
  { key: "impressions", label: "Impressions", groupId: "performance", groupLabel: "Performance" },
  { key: "ctr", label: "CTR", groupId: "performance", groupLabel: "Performance" },
  { key: "clicks", label: "Clicks", groupId: "performance", groupLabel: "Performance" },
];

export const REPORT_SUMMARY_SLOT_COUNT = 5;

export const REPORT_SUMMARY_DEFAULT_SLOT_KEYS: ReportTableMetricKey[] = [
  "cost",
  "cpc",
  "cpa",
  "converted_leads",
  "impressions",
];

/** Mobile report summary uses a 2×3 grid (6 slots). */
export const REPORT_SUMMARY_MOBILE_SLOT_COUNT = 6;

export const REPORT_SUMMARY_MOBILE_DEFAULT_SLOT_KEYS: ReportTableMetricKey[] = [
  "cost",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
  "converted_leads",
];

export type ReportSummaryTotals = {
  costByCurrency: { currency: string; amount: number }[];
  impressions: number;
  clicks: number;
  convertedLeads: number | null;
  /** Blended when all visible rows share one currency. */
  primaryCurrency: string | null;
  blendedCpa: number | null;
  blendedCpc: number | null;
  ctr: number | null;
};

type RowLike = {
  amount: number;
  impressions: number;
  clicks: number;
  convertedLeads: number | null;
  currency: string | null;
};

function ingestRow(
  row: RowLike,
  costByCurrency: Map<string, number>,
  totals: { impressions: number; clicks: number; convertedLeads: number; hasLeads: boolean },
): void {
  const currency = (row.currency ?? "IDR").trim() || "IDR";
  costByCurrency.set(currency, (costByCurrency.get(currency) ?? 0) + row.amount);
  totals.impressions += row.impressions;
  totals.clicks += row.clicks;
  if (row.convertedLeads != null && Number.isFinite(row.convertedLeads)) {
    totals.convertedLeads += row.convertedLeads;
    totals.hasLeads = true;
  }
}

export function aggregateReportTableMetrics(
  googleRows: ReportGoogleServiceRow[],
  metaRows: ReportMetaServiceRow[],
  tiktokRows: ReportTikTokServiceRow[] = [],
): ReportSummaryTotals {
  const costByCurrency = new Map<string, number>();
  const totals = { impressions: 0, clicks: 0, convertedLeads: 0, hasLeads: false };

  for (const row of googleRows) ingestRow(row, costByCurrency, totals);
  for (const row of metaRows) ingestRow(row, costByCurrency, totals);
  for (const row of tiktokRows) ingestRow(row, costByCurrency, totals);

  const costEntries = [...costByCurrency.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);

  const currencies = costEntries.map((e) => e.currency);
  const primaryCurrency = currencies.length === 1 ? currencies[0]! : null;
  const primaryCost = primaryCurrency ? (costByCurrency.get(primaryCurrency) ?? 0) : 0;

  const blendedCpc =
    primaryCurrency && totals.clicks > 0
      ? computeSummaryCpc(primaryCost, totals.clicks)
      : null;

  const blendedCpa =
    primaryCurrency && totals.hasLeads && totals.convertedLeads > 0
      ? primaryCost / totals.convertedLeads
      : null;

  const ctr =
    totals.impressions > 0 ? computeSummaryCtr(totals.clicks, totals.impressions) : null;

  return {
    costByCurrency: costEntries,
    impressions: totals.impressions,
    clicks: totals.clicks,
    convertedLeads: totals.hasLeads ? totals.convertedLeads : null,
    primaryCurrency,
    blendedCpa,
    blendedCpc,
    ctr,
  };
}

/** Fallback totals from channel-level costs when no per-service rows are available. */
export function aggregateReportChannelCosts(
  googleCost: ReportChannelCost,
  metaCost: ReportChannelCost,
  tiktokCost: ReportChannelCost,
): ReportSummaryTotals {
  const costByCurrency = new Map<string, number>();
  let impressions = 0;
  let clicks = 0;

  const ingest = (cost: ReportChannelCost, defaultCurrency: string) => {
    const currency = (cost.currency ?? defaultCurrency).trim() || defaultCurrency;
    const amount = cost.amount ?? 0;
    if (!Number.isFinite(amount)) return;
    costByCurrency.set(currency, (costByCurrency.get(currency) ?? 0) + amount);
    if (cost.connected) {
      impressions += cost.impressions ?? 0;
      clicks += cost.clicks ?? 0;
    }
  };

  ingest(googleCost, DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY);
  ingest(metaCost, DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY);
  ingest(tiktokCost, DIGITAL_MARKETING_REPORT_DISPLAY_CURRENCY);

  const costEntries = [...costByCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);

  const currencies = costEntries.map((e) => e.currency);
  const primaryCurrency = currencies.length === 1 ? currencies[0]! : null;
  const primaryCost = primaryCurrency ? (costByCurrency.get(primaryCurrency) ?? 0) : 0;

  const blendedCpc =
    primaryCurrency && clicks > 0 ? computeSummaryCpc(primaryCost, clicks) : null;

  const ctr = impressions > 0 ? computeSummaryCtr(clicks, impressions) : null;

  return {
    costByCurrency: costEntries,
    impressions,
    clicks,
    convertedLeads: null,
    primaryCurrency,
    blendedCpa: null,
    blendedCpc,
    ctr,
  };
}

export function findReportSummaryMetricOption(
  key: string,
  options: ReportSummaryMetricOption[] = REPORT_SUMMARY_METRIC_OPTIONS,
): ReportSummaryMetricOption | undefined {
  return options.find((o) => o.key === key);
}

export function reportSummaryMetricGroups(
  options: ReportSummaryMetricOption[] = REPORT_SUMMARY_METRIC_OPTIONS,
): { id: string; label: string; options: ReportSummaryMetricOption[] }[] {
  const byGroup = new Map<string, ReportSummaryMetricOption[]>();
  for (const opt of options) {
    const list = byGroup.get(opt.groupId) ?? [];
    list.push(opt);
    byGroup.set(opt.groupId, list);
  }
  return [...byGroup.entries()].map(([id, groupOptions]) => ({
    id,
    label: groupOptions[0]?.groupLabel ?? id,
    options: groupOptions,
  }));
}

function formatCostAmount(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  if (code === "IDR") {
    return formatMetricValue("spent", amount, currency, "micros");
  }
  return formatMetaMetricValue("spend", amount, currency);
}

export function formatReportSummaryMetricValue(
  key: ReportTableMetricKey,
  totals: ReportSummaryTotals | null,
  options?: { mixedCurrencyLabel?: string },
): string {
  if (!totals) return "—";
  const mixed = options?.mixedCurrencyLabel ?? "Mixed currencies";

  switch (key) {
    case "cost": {
      if (totals.costByCurrency.length === 0) return "—";
      if (totals.costByCurrency.length === 1) {
        const { currency, amount } = totals.costByCurrency[0]!;
        return formatCostAmount(amount, currency);
      }
      return totals.costByCurrency
        .map(({ currency, amount }) => formatCostAmount(amount, currency))
        .join(" · ");
    }
    case "impressions":
      return formatMetaMetricValue(
        "impressions",
        totals.impressions,
        totals.primaryCurrency ?? "IDR",
      );
    case "clicks":
      return formatMetaMetricValue("clicks", totals.clicks, totals.primaryCurrency ?? "IDR");
    case "converted_leads":
      if (totals.convertedLeads == null) return "—";
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
        totals.convertedLeads,
      );
    case "ctr":
      return formatMetaCtr(totals.ctr, "computed");
    case "cpc": {
      if (!totals.primaryCurrency || totals.blendedCpc == null) {
        return totals.costByCurrency.length > 1 ? mixed : "—";
      }
      return formatMetricValue(
        "avg_cpc",
        totals.blendedCpc,
        totals.primaryCurrency,
        "micros",
      );
    }
    case "cpa": {
      if (!totals.primaryCurrency || totals.blendedCpa == null) {
        return totals.costByCurrency.length > 1 ? mixed : "—";
      }
      return formatMetricValue(
        "spent",
        totals.blendedCpa,
        totals.primaryCurrency,
        "micros",
      );
    }
    default:
      return "—";
  }
}

/** Numeric value used for period compare — same source as the formatted card value. */
export function reportSummaryNumericValue(
  key: ReportTableMetricKey,
  totals: ReportSummaryTotals | null | undefined,
): number | null {
  if (!totals) return null;
  switch (key) {
    case "cost": {
      if (totals.costByCurrency.length !== 1) return null;
      const amount = totals.costByCurrency[0]!.amount;
      return Number.isFinite(amount) ? amount : null;
    }
    case "impressions":
      return Number.isFinite(totals.impressions) ? totals.impressions : null;
    case "clicks":
      return Number.isFinite(totals.clicks) ? totals.clicks : null;
    case "converted_leads":
      return totals.convertedLeads;
    case "ctr":
      return totals.ctr;
    case "cpc":
      return totals.primaryCurrency ? totals.blendedCpc : null;
    case "cpa":
      return totals.primaryCurrency ? totals.blendedCpa : null;
    default:
      return null;
  }
}

export function reportCompareToneKey(key: ReportTableMetricKey): string {
  return key;
}

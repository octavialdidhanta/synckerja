import { formatMetricValue } from "@/google-ads/metrics/formatMetricValue";
import {
  computeSummaryCpc,
  computeSummaryCtr,
  formatMetaCtr,
  formatMetaMetricValue,
} from "@/meta-ads/metrics/formatMetaMetricValue";
import type { GoogleAdsMetricsSummaryTotals } from "@/google-ads/metrics/types";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type {
  DmAccountPeriodActuals,
  DmReportChannel,
  DmReportTargetProgress,
} from "@/6-0-digital-marketing-shared/dmReportTargetTypes";
import type { ReportTableMetricKey } from "@/6-0-digital-marketing-shared/reportSummaryMetrics";
import {
  expandReportMetricsWithDependencies,
  reportMetricValueKind,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricMapping";
import { isPercentScaleMetricKey } from "@/6-0-digital-marketing-shared/dmReportTargetPeriod";

function parseMetricNumber(raw: unknown): number | null {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function aggregateConvertedLeads(rows: Array<MetaAdsMetricsRow | TikTokAdsMetricsRow>): number | null {
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
  return hasLeads ? convertedLeads : null;
}

export type DmMetaPeriodSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  currency: string;
  content_views?: number;
  adds_to_cart?: number;
  purchases?: number;
  purchase_conversion_value?: number;
  view_to_atc_rate?: number | null;
  atc_to_purchase_rate?: number | null;
  aov?: number | null;
};

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/** Meta KPI extras. Rates are already percent (2.5 = 2.5%). CPM is cost per 1,000 impressions. */
export function metaKpiActualFromSummary(
  summary: DmMetaPeriodSummary | null | undefined,
  metricKey: string,
): number | null {
  if (!summary) return null;
  switch (metricKey) {
    case "cpm":
      return summary.impressions > 0 ? (summary.spend / summary.impressions) * 1000 : null;
    case "view_to_atc_rate":
      return finiteOrNull(summary.view_to_atc_rate);
    case "atc_to_purchase_rate":
      return finiteOrNull(summary.atc_to_purchase_rate);
    case "aov":
      return finiteOrNull(summary.aov);
    case "content_views":
      return finiteOrNull(summary.content_views);
    case "adds_to_cart":
      return finiteOrNull(summary.adds_to_cart);
    case "purchases":
      return finiteOrNull(summary.purchases);
    case "purchase_conversion_value":
      return finiteOrNull(summary.purchase_conversion_value);
    default:
      return null;
  }
}

export function actualValueFromGoogleTotals(
  totals: GoogleAdsMetricsSummaryTotals | null | undefined,
  reportKey: ReportTableMetricKey,
): number | null {
  if (!totals) return null;
  const apiMap: Record<ReportTableMetricKey, string> = {
    cost: "spent",
    cpc: "avg_cpc",
    cpa: "cost_per_conv",
    converted_leads: "conversions",
    impressions: "impressions",
    ctr: "ctr",
    clicks: "clicks",
  };
  const apiKey = apiMap[reportKey];
  if (totals.by_key && apiKey in totals.by_key) {
    const v = totals.by_key[apiKey];
    return v != null && Number.isFinite(v) ? v : null;
  }
  if (reportKey === "cost") return totals.spent ?? null;
  if (reportKey === "impressions") return totals.impressions ?? null;
  if (reportKey === "clicks") return totals.clicks ?? null;
  if (reportKey === "ctr") return totals.ctr ?? null;
  if (reportKey === "converted_leads") return totals.conversions ?? null;
  return null;
}

export function actualValueFromMetaTikTok(
  summary: DmMetaPeriodSummary | null | undefined,
  rows: Array<MetaAdsMetricsRow | TikTokAdsMetricsRow>,
  reportKey: ReportTableMetricKey,
): number | null {
  if (!summary) return null;
  const spend = summary.spend ?? 0;
  const impressions = summary.impressions ?? 0;
  const clicks = summary.clicks ?? 0;
  const convertedLeads = aggregateConvertedLeads(rows);

  switch (reportKey) {
    case "cost":
      return spend;
    case "impressions":
      return impressions;
    case "clicks":
      return clicks;
    case "ctr":
      return computeSummaryCtr(clicks, impressions);
    case "cpc":
      return computeSummaryCpc(spend, clicks);
    case "converted_leads":
      return convertedLeads;
    case "cpa":
      return convertedLeads != null && convertedLeads > 0 ? spend / convertedLeads : null;
    default:
      return null;
  }
}

export function buildDmAccountActuals(args: {
  channel: DmReportChannel;
  accountId: string;
  selectedMetricKeys: string[];
  connected: boolean;
  currencyCode: string | null;
  googleTotals?: GoogleAdsMetricsSummaryTotals | null;
  metaTikTokSummary?: DmMetaPeriodSummary | null;
  metaTikTokRows?: Array<MetaAdsMetricsRow | TikTokAdsMetricsRow>;
}): DmAccountPeriodActuals {
  const metrics: Record<string, number | null> = {};
  const keysToPopulate = expandReportMetricsWithDependencies(args.selectedMetricKeys);
  for (const key of keysToPopulate) {
    if (!isReportMetricKey(key)) {
      metrics[key] =
        args.channel === "google"
          ? null
          : metaKpiActualFromSummary(args.metaTikTokSummary, key);
      continue;
    }
    if (args.channel === "google") {
      metrics[key] = actualValueFromGoogleTotals(args.googleTotals, key);
    } else {
      metrics[key] = actualValueFromMetaTikTok(
        args.metaTikTokSummary,
        args.metaTikTokRows ?? [],
        key,
      );
    }
  }
  return {
    channel: args.channel,
    accountId: args.accountId,
    hasConnectedAccount: args.connected,
    metrics,
    currencyCode: args.currencyCode,
  };
}

function isReportMetricKey(key: string): key is ReportTableMetricKey {
  return (
    key === "cost" ||
    key === "cpc" ||
    key === "cpa" ||
    key === "converted_leads" ||
    key === "impressions" ||
    key === "ctr" ||
    key === "clicks"
  );
}

export function actualValueForAccount(
  actuals: DmAccountPeriodActuals,
  metricKey: string,
): number | null {
  return actuals.metrics[metricKey] ?? null;
}

export function formatDmActualValue(
  channel: DmReportChannel,
  metricKey: string,
  value: number | null | undefined,
  currencyCode: string | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (
    metricKey === "cpm" ||
    metricKey === "aov" ||
    metricKey === "view_to_atc_rate" ||
    metricKey === "atc_to_purchase_rate"
  ) {
    return formatMetaMetricValue(metricKey, value, currencyCode ?? "IDR");
  }
  const kind = isReportMetricKey(metricKey) ? reportMetricValueKind(metricKey) : "count";

  if (channel === "google") {
    const googleKey =
      metricKey === "cost"
        ? "spent"
        : metricKey === "cpc"
          ? "avg_cpc"
          : metricKey === "cpa"
            ? "cost_per_conv"
            : metricKey === "converted_leads"
              ? "conversions"
              : metricKey;
    const formatKind =
      metricKey === "cost" || googleKey === "spent" ? "micros" : kind;
    return formatMetricValue(
      googleKey,
      value,
      currencyCode,
      formatKind as import("@/google-ads/metrics/types").MetricValueKind,
    );
  }

  if (metricKey === "ctr") {
    return formatMetaCtr(value, "computed");
  }

  const metaKey =
    metricKey === "cost"
      ? "spend"
      : metricKey === "converted_leads"
        ? "service_converted_leads"
        : metricKey === "cpa"
          ? "service_cpl"
          : metricKey;
  return formatMetaMetricValue(metaKey, value, currencyCode ?? "IDR");
}

/** Progress actual/target are already on the target scale (CTR is percent, not a fraction). */
export function formatDmProgressValue(
  metricKey: string,
  value: number | null | undefined,
  currencyCode: string | null | undefined,
): string {
  if (isPercentScaleMetricKey(metricKey)) {
    if (value == null || !Number.isFinite(value)) return "—";
    return `${value.toFixed(2)}%`;
  }
  return formatDmActualValue("google", metricKey, value, currencyCode);
}

export function formatDmReportProgressRatio(
  progress: DmReportTargetProgress | undefined,
  currencyCode: string | null | undefined,
): string | null {
  if (
    !progress?.showProgress ||
    progress.target == null ||
    progress.target <= 0 ||
    progress.actual == null
  ) {
    return null;
  }
  const current = formatDmProgressValue(progress.metricKey, progress.actual, currencyCode);
  const target = formatDmProgressValue(progress.metricKey, progress.target, currencyCode);
  if (progress.baseline != null) {
    const before = formatDmProgressValue(progress.metricKey, progress.baseline, currencyCode);
    return `${before} → ${current} / ${target}`;
  }
  return `${current} / ${target}`;
}

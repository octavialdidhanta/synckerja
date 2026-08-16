import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import {
  getMetaAdsMetricsForEntity,
  isMetaAdsSynckerjaMetricKey,
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

export function buildMetaAdsSummaryTotals(
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    reach?: number;
    currency: string;
  } | null | undefined,
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
    convertedLeads: attribution.hasLeads ? attribution.convertedLeads : null,
    cpa,
  };
}

export function metaAdsSummaryValidKeys(entity: MetaAdsMetricEntity): MetaAdsTableMetricKey[] {
  const keys = getMetaAdsMetricsForEntity(entity)
    .filter((m) => !isMetaAdsSynckerjaMetricKey(m.key))
    .map((m) => m.key as MetaAdsTableMetricKey);
  if (entity === "campaign") {
    keys.push("service_cpl", "service_converted_leads");
  }
  return keys;
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

  for (const item of args.catalogItems) {
    if (isMetaAdsSynckerjaMetricKey(item.key)) continue;
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
  const valid = new Set(validKeys);
  const result: MetaAdsTableMetricKey[] = [];
  for (let i = 0; i < META_ADS_SUMMARY_SLOT_COUNT; i++) {
    const fallback = META_ADS_SUMMARY_DEFAULT_SLOT_KEYS[i] ?? "spend";
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

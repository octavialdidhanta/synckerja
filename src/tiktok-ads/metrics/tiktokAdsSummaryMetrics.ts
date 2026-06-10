import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import {
  getTikTokAdsMetricsForEntity,
  type TikTokAdsMetricCatalogItem,
} from "@/tiktok-ads/metrics/tiktokAdsMetricCatalog";
import {
  computeSummaryCtr,
  computeSummaryCpc,
  formatTikTokCtr,
  formatTikTokMetricValue,
  parseMetricNumber,
} from "@/tiktok-ads/metrics/formatTikTokMetricValue";

/** Metrics available as table columns (catalog + campaign service columns). */
export type TikTokAdsTableMetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "reach"
  | "service_cpl"
  | "service_converted_leads";

export type TikTokAdsSummaryMetricOption = {
  key: TikTokAdsTableMetricKey;
  label: string;
  groupId: "performance" | "attribution";
  groupLabel: string;
};

export const TIKTOK_ADS_SUMMARY_SLOT_COUNT = 5;

export const TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS: TikTokAdsTableMetricKey[] = [
  "spend",
  "impressions",
  "clicks",
  "ctr",
  "cpc",
];

const CAMPAIGN_ONLY_KEYS = new Set<TikTokAdsTableMetricKey>([
  "service_cpl",
  "service_converted_leads",
]);

export type TikTokAdsSummaryTotals = {
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

function aggregateCampaignAttribution(rows: TikTokAdsMetricsRow[]): {
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

export function buildTikTokAdsSummaryTotals(
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    reach?: number;
    currency: string;
  } | null | undefined,
  rows: TikTokAdsMetricsRow[],
  entity: TikTokAdsMetricEntity,
): TikTokAdsSummaryTotals | null {
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

export function tiktokAdsSummaryValidKeys(entity: TikTokAdsMetricEntity): TikTokAdsTableMetricKey[] {
  const keys = getTikTokAdsMetricsForEntity(entity).map((m) => m.key as TikTokAdsTableMetricKey);
  if (entity === "campaign") {
    keys.push("service_cpl", "service_converted_leads");
  }
  return keys;
}

export function buildTikTokAdsSummaryMetricOptions(args: {
  entity: TikTokAdsMetricEntity;
  catalogItems: TikTokAdsMetricCatalogItem[];
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
}): TikTokAdsSummaryMetricOption[] {
  const options: TikTokAdsSummaryMetricOption[] = [];

  for (const item of args.catalogItems) {
    const key = item.key as TikTokAdsTableMetricKey;
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

export function tiktokAdsSummaryMetricGroups(
  options: TikTokAdsSummaryMetricOption[],
): { id: string; label: string; options: TikTokAdsSummaryMetricOption[] }[] {
  const byGroup = new Map<string, TikTokAdsSummaryMetricOption[]>();
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

export function findTikTokAdsSummaryMetricOption(
  key: string,
  options: TikTokAdsSummaryMetricOption[],
): TikTokAdsSummaryMetricOption | undefined {
  return options.find((o) => o.key === key);
}

export function formatTikTokAdsSummaryMetricValue(
  key: TikTokAdsTableMetricKey,
  totals: TikTokAdsSummaryTotals | null,
): string {
  if (!totals) return "—";

  switch (key) {
    case "spend":
      return formatTikTokMetricValue("spend", totals.spend, totals.currency);
    case "impressions":
      return formatTikTokMetricValue("impressions", totals.impressions, totals.currency);
    case "clicks":
      return formatTikTokMetricValue("clicks", totals.clicks, totals.currency);
    case "reach":
      if (totals.reach == null) return "—";
      return formatTikTokMetricValue("reach", totals.reach, totals.currency);
    case "ctr":
      return formatTikTokCtr(totals.ctr, "computed");
    case "cpc":
      return formatTikTokMetricValue("cpc", totals.cpc, totals.currency);
    case "cpm":
      return formatTikTokMetricValue("cpm", totals.cpm, totals.currency);
    case "service_converted_leads":
      if (totals.convertedLeads == null) return "—";
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
        totals.convertedLeads,
      );
    case "service_cpl":
      return formatTikTokMetricValue("spend", totals.cpa, totals.currency);
    default:
      return "—";
  }
}

export function normalizeTikTokAdsSummarySlotKeys(
  keys: string[],
  validKeys: Iterable<TikTokAdsTableMetricKey>,
  entity: TikTokAdsMetricEntity,
): TikTokAdsTableMetricKey[] {
  const valid = new Set(validKeys);
  const result: TikTokAdsTableMetricKey[] = [];
  for (let i = 0; i < TIKTOK_ADS_SUMMARY_SLOT_COUNT; i++) {
    const fallback = TIKTOK_ADS_SUMMARY_DEFAULT_SLOT_KEYS[i] ?? "spend";
    const key = keys[i];
    if (key && valid.has(key as TikTokAdsTableMetricKey)) {
      const k = key as TikTokAdsTableMetricKey;
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

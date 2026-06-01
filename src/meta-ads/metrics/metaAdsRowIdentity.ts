import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";

export function metaAdsRowDisplayName(
  row: MetaAdsMetricsRow,
  entity: MetaAdsMetricEntity,
): string {
  const r = row as Record<string, unknown>;
  if (entity === "campaign") return String(r.campaign_name ?? r.campaign_id ?? "—");
  if (entity === "adset") return String(r.adset_name ?? r.adset_id ?? "—");
  return String(r.ad_name ?? r.ad_id ?? "—");
}

export function metaAdsRowSecondaryName(
  row: MetaAdsMetricsRow,
  entity: MetaAdsMetricEntity,
): string | null {
  const r = row as Record<string, unknown>;
  if (entity === "adset") return String(r.campaign_name ?? "") || null;
  if (entity === "ad") return String(r.adset_name ?? "") || null;
  return null;
}

/** Stable React list key — uses entity-level id, not parent campaign_id. */
export function metaAdsRowReactKey(
  row: MetaAdsMetricsRow,
  entity: MetaAdsMetricEntity,
  index: number,
): string {
  const r = row as Record<string, unknown>;
  if (entity === "campaign") {
    return `campaign-${String(r.campaign_id ?? index)}-${index}`;
  }
  if (entity === "adset") {
    return `adset-${String(r.adset_id ?? r.campaign_id ?? index)}-${index}`;
  }
  return `ad-${String(r.ad_id ?? r.adset_id ?? index)}-${index}`;
}

export function metaAdsRowSortKey(
  row: MetaAdsMetricsRow,
  field: string,
  entity: MetaAdsMetricEntity,
): string | number {
  const r = row as Record<string, unknown>;
  if (field === "name") return metaAdsRowDisplayName(row, entity).toLowerCase();
  if (field === "campaign_name") return String(r.campaign_name ?? "").toLowerCase();
  if (field === "adset_name") return String(r.adset_name ?? "").toLowerCase();
  const raw = r[field];
  const n = parseFloat(String(raw ?? "").replace(/,/g, ""));
  if (Number.isFinite(n)) return n;
  return String(raw ?? "").toLowerCase();
}

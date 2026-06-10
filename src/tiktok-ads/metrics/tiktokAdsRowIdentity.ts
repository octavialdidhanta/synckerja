import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";

export function tiktokAdsRowDisplayName(
  row: TikTokAdsMetricsRow,
  entity: TikTokAdsMetricEntity,
): string {
  const r = row as Record<string, unknown>;
  if (entity === "campaign") return String(r.campaign_name ?? r.campaign_id ?? "—");
  if (entity === "adgroup") return String(r.adgroup_name ?? r.adgroup_id ?? "—");
  return String(r.ad_name ?? r.ad_id ?? "—");
}

export function tiktokAdsRowSecondaryName(
  row: TikTokAdsMetricsRow,
  entity: TikTokAdsMetricEntity,
): string | null {
  const r = row as Record<string, unknown>;
  if (entity === "adgroup") return String(r.campaign_name ?? "") || null;
  if (entity === "ad") return String(r.adgroup_name ?? "") || null;
  return null;
}

/** Stable React list key — uses entity-level id, not parent campaign_id. */
export function tiktokAdsRowReactKey(
  row: TikTokAdsMetricsRow,
  entity: TikTokAdsMetricEntity,
  index: number,
): string {
  const r = row as Record<string, unknown>;
  if (entity === "campaign") {
    return `campaign-${String(r.campaign_id ?? index)}-${index}`;
  }
  if (entity === "adgroup") {
    return `adgroup-${String(r.adgroup_id ?? r.campaign_id ?? index)}-${index}`;
  }
  return `ad-${String(r.ad_id ?? r.adgroup_id ?? index)}-${index}`;
}

export function tiktokAdsRowSortKey(
  row: TikTokAdsMetricsRow,
  field: string,
  entity: TikTokAdsMetricEntity,
): string | number {
  const r = row as Record<string, unknown>;
  if (field === "name") return tiktokAdsRowDisplayName(row, entity).toLowerCase();
  if (field === "campaign_name") return String(r.campaign_name ?? "").toLowerCase();
  if (field === "adgroup_name") return String(r.adgroup_name ?? "").toLowerCase();
  if (field === "service") return String(r.service_name ?? "").toLowerCase();
  if (field === "service_cpl") {
    const n = Number(r.service_cpl);
    return Number.isFinite(n) ? n : -1;
  }
  if (field === "service_converted_leads") {
    const n = Number(r.service_converted_leads);
    return Number.isFinite(n) ? n : -1;
  }
  const raw = r[field];
  const n = parseFloat(String(raw ?? "").replace(/,/g, ""));
  if (Number.isFinite(n)) return n;
  return String(raw ?? "").toLowerCase();
}

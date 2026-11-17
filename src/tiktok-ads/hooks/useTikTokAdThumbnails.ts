import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import type { TikTokAdsMetricEntity, TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";

function adIdsMissingThumbnails(rows: TikTokAdsMetricsRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (String(row.thumbnail_url ?? "").trim()) continue;
    const id = String(row.ad_id ?? "").trim();
    if (id) ids.add(id);
  }
  return [...ids].sort();
}

export function mergeTikTokAdThumbnails(
  rows: TikTokAdsMetricsRow[],
  thumbnails: Record<string, string> | undefined,
): TikTokAdsMetricsRow[] {
  if (!thumbnails) return rows;
  return rows.map((row) => {
    if (String(row.thumbnail_url ?? "").trim()) return row;
    const url = thumbnails[String(row.ad_id ?? "").trim()];
    return url ? { ...row, thumbnail_url: url } : row;
  });
}

export function useTikTokAdThumbnails(args: {
  organizationId: string | null | undefined;
  advertiserId: string;
  entity: TikTokAdsMetricEntity;
  rows: TikTokAdsMetricsRow[];
  enabled?: boolean;
}) {
  const { organizationId, advertiserId, entity, rows, enabled = true } = args;
  const adIds = useMemo(
    () => (entity === "ad" ? adIdsMissingThumbnails(rows) : []),
    [entity, rows],
  );

  return useQuery({
    queryKey: ["tiktok-ad-thumbnails", organizationId, advertiserId, adIds],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("tiktok-ads-ad-thumbnails", {
        body: {
          organization_id: organizationId,
          advertiser_id: advertiserId,
          ad_ids: adIds,
        },
      });
      if (error) throw error;
      const payload = data as { thumbnails?: Record<string, string>; error?: string };
      if (payload?.error) throw new Error(payload.error);
      return payload.thumbnails ?? {};
    },
    enabled: Boolean(organizationId && advertiserId && enabled && adIds.length > 0),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

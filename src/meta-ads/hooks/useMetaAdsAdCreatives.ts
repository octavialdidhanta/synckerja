import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type MetaAdCreativePreview = {
  ad_id: string;
  thumbnail_url: string | null;
  image_url: string | null;
  video_url: string | null;
  preview_url: string | null;
  headline: string | null;
  description: string | null;
  images: string[];
  media_type: "image" | "video" | "carousel" | "unknown";
};

export function useMetaAdsAdCreatives(args: {
  enabled: boolean;
  organizationId: string | null | undefined;
  adAccountId: string | null | undefined;
  adIds: string[];
}) {
  const { enabled, organizationId, adAccountId, adIds } = args;
  const ids = [...new Set(adIds.map((id) => id.trim()).filter((id) => /^\d+$/.test(id)))].sort();

  return useQuery({
    queryKey: ["meta-ads-ad-creatives-v3", organizationId, adAccountId, ids.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-ads-ad-creatives", {
        body: {
          organization_id: organizationId,
          ad_account_id: adAccountId,
          ad_ids: ids,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as { creatives?: MetaAdCreativePreview[]; error?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      const map = new Map<string, MetaAdCreativePreview>();
      for (const row of payload.creatives ?? []) {
        if (row?.ad_id) map.set(String(row.ad_id), row);
      }
      return map;
    },
    enabled: Boolean(enabled && organizationId && adAccountId && ids.length > 0),
    staleTime: 10 * 60 * 1000,
  });
}

export function useMetaAdCreativePlayback(args: {
  enabled: boolean;
  organizationId: string | null | undefined;
  adAccountId: string | null | undefined;
  adId: string | null | undefined;
}) {
  const { enabled, organizationId, adAccountId, adId } = args;
  const id = String(adId ?? "").trim();

  return useQuery({
    queryKey: ["meta-ads-ad-playback-v2", organizationId, adAccountId, id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-ads-ad-creatives", {
        body: {
          organization_id: organizationId,
          ad_account_id: adAccountId,
          ad_ids: [id],
          resolve_playback: true,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as { creatives?: MetaAdCreativePreview[]; error?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      return payload.creatives?.find((row) => row.ad_id === id) ?? payload.creatives?.[0] ?? null;
    },
    enabled: Boolean(enabled && organizationId && adAccountId && /^\d+$/.test(id)),
    staleTime: 10 * 60 * 1000,
  });
}

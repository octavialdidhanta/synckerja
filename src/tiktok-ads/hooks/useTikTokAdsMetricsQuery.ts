import { useQuery } from "@tanstack/react-query";
import { clampTikTokAdsDateRange } from "@/tiktok-ads/lib/clampTikTokAdsDateRange";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type TikTokAdsMetricEntity = "campaign" | "adgroup" | "ad";

export type TikTokAdsMetricsRow = Record<string, unknown>;

export type TikTokAdsMetricsResponse = {
  rows: TikTokAdsMetricsRow[];
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    currency: string;
  };
  entity: TikTokAdsMetricEntity;
  advertiser_id: string;
  /** Alias for advertiser_id in API responses. */
  ad_account_id?: string;
  date_start: string;
  date_end: string;
  next_page_token: string | null;
  cached?: boolean;
};

export async function fetchTikTokAdsMetrics(args: {
  organizationId: string;
  advertiserId: string;
  entity: TikTokAdsMetricEntity;
  dateStart: string;
  dateEnd: string;
  pageToken?: string;
  forceRefresh?: boolean;
}): Promise<TikTokAdsMetricsResponse> {
  const {
    organizationId,
    advertiserId,
    entity,
    dateStart,
    dateEnd,
    pageToken = "",
    forceRefresh = false,
  } = args;
  const { start, end } = clampTikTokAdsDateRange(dateStart, dateEnd);
  const { data, error } = await supabase.functions.invoke("tiktok-ads-metrics", {
    body: {
      organization_id: organizationId,
      advertiser_id: advertiserId,
      entity,
      date_start: start,
      date_end: end,
      page_token: pageToken,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as TikTokAdsMetricsResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useTikTokAdsMetricsQuery(args: {
  organizationId: string | null | undefined;
  advertiserId: string;
  entity: TikTokAdsMetricEntity;
  dateStart: string;
  dateEnd: string;
  pageToken?: string;
  enabled?: boolean;
}) {
  const {
    organizationId,
    advertiserId,
    entity,
    dateStart,
    dateEnd,
    pageToken = "",
    enabled = true,
  } = args;

  return useQuery({
    queryKey: [
      "tiktok-ads-metrics",
      organizationId,
      advertiserId,
      entity,
      dateStart,
      dateEnd,
      pageToken,
    ],
    queryFn: async () => {
      if (!organizationId || !advertiserId) return null;
      return fetchTikTokAdsMetrics({
        organizationId,
        advertiserId,
        entity,
        dateStart,
        dateEnd,
        pageToken,
      });
    },
    enabled: Boolean(organizationId && advertiserId && enabled),
    staleTime: 60_000,
  });
}

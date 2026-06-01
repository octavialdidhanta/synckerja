import { useQuery } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import { supabase } from "@/shared/lib/supabaseClient";

export type MetaAdsMetricEntity = "campaign" | "adset" | "ad";

export type MetaAdsMetricsRow = Record<string, unknown>;

export type MetaAdsMetricsResponse = {
  rows: MetaAdsMetricsRow[];
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    currency: string;
  };
  entity: MetaAdsMetricEntity;
  ad_account_id: string;
  date_start: string;
  date_end: string;
  next_page_token: string | null;
  cached?: boolean;
};

export function useMetaAdsMetricsQuery(args: {
  organizationId: string | null | undefined;
  adAccountId: string;
  entity: MetaAdsMetricEntity;
  dateStart: string;
  dateEnd: string;
  pageToken?: string;
  enabled?: boolean;
}) {
  const {
    organizationId,
    adAccountId,
    entity,
    dateStart,
    dateEnd,
    pageToken = "",
    enabled = true,
  } = args;

  return useQuery({
    queryKey: [
      "meta-ads-metrics",
      organizationId,
      adAccountId,
      entity,
      dateStart,
      dateEnd,
      pageToken,
    ],
    queryFn: async () => {
      if (!organizationId || !adAccountId) return null;
      const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
        body: {
          organization_id: organizationId,
          ad_account_id: adAccountId,
          entity,
          date_start: dateStart,
          date_end: dateEnd,
          page_token: pageToken,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as MetaAdsMetricsResponse & { error?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      return payload;
    },
    enabled: Boolean(organizationId && adAccountId && enabled),
    staleTime: 60_000,
  });
}

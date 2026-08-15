import { type QueryClient, useQuery } from "@tanstack/react-query";
import { clampMetaAdsDateRange } from "@/meta-ads/lib/clampMetaAdsDateRange";
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
    reach: number;
    currency: string;
  };
  entity: MetaAdsMetricEntity;
  ad_account_id: string;
  date_start: string;
  date_end: string;
  next_page_token: string | null;
  cached?: boolean;
};

export function buildMetaAdsMetricsQueryKey(args: {
  organizationId: string | null | undefined;
  adAccountId: string;
  entity: MetaAdsMetricEntity;
  dateStart: string;
  dateEnd: string;
  pageToken?: string;
}): readonly unknown[] {
  const { organizationId, adAccountId, entity, dateStart, dateEnd, pageToken = "" } = args;
  return [
    "meta-ads-metrics",
    organizationId,
    adAccountId,
    entity,
    dateStart,
    dateEnd,
    pageToken,
  ] as const;
}

export async function refreshMetaAdsMetrics(
  queryClient: QueryClient,
  args: {
    organizationId: string;
    adAccountId: string;
    entity: MetaAdsMetricEntity;
    dateStart: string;
    dateEnd: string;
    pageToken?: string;
  },
): Promise<MetaAdsMetricsResponse> {
  const pageToken = args.pageToken ?? "";
  const queryKey = buildMetaAdsMetricsQueryKey({ ...args, pageToken });
  const fresh = await fetchMetaAdsMetrics({
    organizationId: args.organizationId,
    adAccountId: args.adAccountId,
    entity: args.entity,
    dateStart: args.dateStart,
    dateEnd: args.dateEnd,
    pageToken,
    forceRefresh: true,
  });
  queryClient.setQueryData(queryKey, fresh);
  return fresh;
}

export async function fetchMetaAdsMetrics(args: {
  organizationId: string;
  adAccountId: string;
  entity: MetaAdsMetricEntity;
  dateStart: string;
  dateEnd: string;
  pageToken?: string;
  forceRefresh?: boolean;
}): Promise<MetaAdsMetricsResponse> {
  const {
    organizationId,
    adAccountId,
    entity,
    dateStart,
    dateEnd,
    pageToken = "",
    forceRefresh = false,
  } = args;
  const { start, end } = clampMetaAdsDateRange(dateStart, dateEnd);
  const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
    body: {
      organization_id: organizationId,
      ad_account_id: adAccountId,
      entity,
      date_start: start,
      date_end: end,
      page_token: pageToken,
      force_refresh: forceRefresh,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as MetaAdsMetricsResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

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
    queryKey: buildMetaAdsMetricsQueryKey({
      organizationId,
      adAccountId,
      entity,
      dateStart,
      dateEnd,
      pageToken,
    }),
    queryFn: async () => {
      if (!organizationId || !adAccountId) return null;
      return fetchMetaAdsMetrics({
        organizationId,
        adAccountId,
        entity,
        dateStart,
        dateEnd,
        pageToken,
      });
    },
    enabled: Boolean(organizationId && adAccountId && enabled),
    staleTime: 60_000,
  });
}

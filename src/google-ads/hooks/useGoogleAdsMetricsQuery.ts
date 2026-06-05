import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type {
  GoogleAdsMetricEntity,
  GoogleAdsMetricsResponse,
  GoogleAdsMetricsSort,
} from "@/google-ads/metrics/types";

export type GoogleAdsMetricsFilters = {
  customerId: string;
  entity: GoogleAdsMetricEntity;
  metrics: string[];
  dateRange: { preset?: string; start?: string; end?: string };
  onlyRunning: boolean;
  statusFilter: "all" | "enabled_only";
  pageToken: string;
  pageSize: number;
  sort: GoogleAdsMetricsSort;
  campaignFilterId?: string;
  adGroupFilterId?: string;
  forceRefresh?: boolean;
  /** Summary bar slot metrics (catalog keys or conv_action:…). */
  summaryMetrics?: string[];
  /** @deprecated Use summaryMetrics — kept for backward compat with edge. */
  summaryPrimaryMetric?: string;
};

export function buildGoogleAdsMetricsQueryKey(
  organizationId: string | null | undefined,
  filters: GoogleAdsMetricsFilters | null,
): readonly unknown[] {
  const sortedMetrics = filters?.metrics ? [...filters.metrics].sort().join("|") : "";
  return [
    "google-ads-metrics-v2",
    organizationId,
    filters?.customerId,
    filters?.entity,
    sortedMetrics,
    filters?.dateRange,
    filters?.onlyRunning,
    filters?.statusFilter,
    filters?.pageToken,
    filters?.pageSize,
    filters?.sort?.field,
    filters?.sort?.direction,
    filters?.campaignFilterId ?? "",
    filters?.adGroupFilterId ?? "",
    filters?.summaryMetrics?.join("|") ?? filters?.summaryPrimaryMetric ?? "spent",
  ] as const;
}

export async function fetchGoogleAdsMetrics(
  organizationId: string,
  filters: GoogleAdsMetricsFilters,
): Promise<GoogleAdsMetricsResponse> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: {
      action: "fetchMetrics",
      organization_id: organizationId,
      customer_id: filters.customerId,
      entity: filters.entity,
      metrics: filters.metrics,
      date_range: filters.dateRange,
      only_running: filters.onlyRunning,
      status_filter: filters.statusFilter,
      page_size: filters.pageSize,
      page_token: filters.pageToken,
      page_offset: filters.pageToken ? Number(filters.pageToken) : 0,
      sort: filters.sort,
      campaign_filter_id: filters.campaignFilterId || undefined,
      ad_group_filter_id: filters.adGroupFilterId || undefined,
      force_refresh: filters.forceRefresh === true,
      summary_metrics:
        filters.summaryMetrics && filters.summaryMetrics.length > 0
          ? filters.summaryMetrics
          : undefined,
      summary_primary_metric:
        filters.summaryPrimaryMetric ??
        filters.summaryMetrics?.[0] ??
        "spent",
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as GoogleAdsMetricsResponse;
  if (payload?.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useGoogleAdsMetricsQuery(
  organizationId: string | null | undefined,
  filters: GoogleAdsMetricsFilters | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: buildGoogleAdsMetricsQueryKey(organizationId, filters),
    queryFn: async () => {
      if (!organizationId || !filters?.customerId) {
        throw new Error("Missing organization or customer");
      }
      return fetchGoogleAdsMetrics(organizationId, filters);
    },
    enabled: Boolean(organizationId) && Boolean(filters?.customerId) && enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export async function fetchGoogleAdsMetricsFresh(
  organizationId: string,
  filters: GoogleAdsMetricsFilters,
): Promise<GoogleAdsMetricsResponse> {
  return fetchGoogleAdsMetrics(organizationId, { ...filters, forceRefresh: true });
}

import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
  sort: GoogleAdsMetricsSort;
};

async function fetchMetrics(
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
      page_size: 50,
      page_token: filters.pageToken || undefined,
      sort: filters.sort,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as GoogleAdsMetricsResponse;
  if (payload?.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useGoogleAdsMetrics(
  organizationId: string | null | undefined,
  filters: GoogleAdsMetricsFilters | null,
  enabled: boolean,
) {
  const sortedMetrics = filters?.metrics ? [...filters.metrics].sort().join("|") : "";

  return useQuery({
    queryKey: [
      "google-ads-metrics",
      organizationId,
      filters?.customerId,
      filters?.entity,
      sortedMetrics,
      filters?.dateRange,
      filters?.onlyRunning,
      filters?.statusFilter,
      filters?.pageToken,
      filters?.sort?.field,
      filters?.sort?.direction,
    ],
    queryFn: async () => {
      if (!organizationId || !filters?.customerId) {
        throw new Error("Missing organization or customer");
      }
      return fetchMetrics(organizationId, filters);
    },
    enabled: Boolean(organizationId) && Boolean(filters?.customerId) && enabled,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type {
  GoogleAdsMetricCatalogResponse,
  GoogleAdsMetricEntity,
} from "@/google-ads/metrics/types";

const EMPTY_CATALOG: GoogleAdsMetricCatalogResponse = {
  max_metrics: 50,
  identity_columns: [],
  recommended_keys: [],
  recommended: { id: "recommended", label: "Recommended columns", metrics: [] },
  categories: [],
};

async function invokeMetrics(
  organizationId: string,
  body: Record<string, unknown>,
): Promise<GoogleAdsMetricCatalogResponse> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: { organization_id: organizationId, ...body },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as GoogleAdsMetricCatalogResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return {
    max_metrics: payload.max_metrics ?? 50,
    identity_columns: payload.identity_columns ?? [],
    recommended_keys: payload.recommended_keys ?? [],
    recommended: payload.recommended ?? EMPTY_CATALOG.recommended,
    categories: payload.categories ?? [],
  };
}

export function useGoogleAdsMetricCatalog(
  organizationId: string | null | undefined,
  entity: GoogleAdsMetricEntity,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["google-ads-metric-catalog", organizationId, entity],
    queryFn: async () => {
      if (!organizationId) return EMPTY_CATALOG;
      return invokeMetrics(organizationId, { action: "listMetricCatalog", entity });
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

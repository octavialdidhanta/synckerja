import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import { buildGoogleAdsMetricCatalogClient } from "@/google-ads/metrics/googleAdsMetricCatalogClient";
import type {
  GoogleAdsMetricCatalogResponse,
  GoogleAdsMetricEntity,
} from "@/google-ads/metrics/types";

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
    recommended: payload.recommended ?? buildGoogleAdsMetricCatalogClient("campaign").recommended,
    categories: payload.categories ?? [],
  };
}

export function useGoogleAdsMetricCatalog(
  organizationId: string | null | undefined,
  entity: GoogleAdsMetricEntity,
  enabled: boolean,
) {
  const clientCatalog = buildGoogleAdsMetricCatalogClient(entity);

  return useQuery({
    queryKey: ["google-ads-metric-catalog", "v3", organizationId, entity],
    queryFn: async () => {
      if (!organizationId) return clientCatalog;
      try {
        return await invokeMetrics(organizationId, { action: "listMetricCatalog", entity });
      } catch {
        return clientCatalog;
      }
    },
    enabled: Boolean(organizationId) && enabled,
    initialData: clientCatalog,
    placeholderData: () => buildGoogleAdsMetricCatalogClient(entity),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

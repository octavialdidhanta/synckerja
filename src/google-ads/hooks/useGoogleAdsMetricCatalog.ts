import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type { GoogleAdsMetricEntity, MetricCatalogCategory } from "@/google-ads/metrics/types";

type CatalogResponse = {
  categories: MetricCatalogCategory[];
};

async function invokeMetrics(
  organizationId: string,
  body: Record<string, unknown>,
): Promise<CatalogResponse> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: { organization_id: organizationId, ...body },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as CatalogResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload;
}

export function useGoogleAdsMetricCatalog(
  organizationId: string | null | undefined,
  entity: GoogleAdsMetricEntity,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["google-ads-metric-catalog", organizationId, entity],
    queryFn: async () => {
      if (!organizationId) return { categories: [] as MetricCatalogCategory[] };
      return invokeMetrics(organizationId, { action: "listMetricCatalog", entity });
    },
    enabled: Boolean(organizationId) && enabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

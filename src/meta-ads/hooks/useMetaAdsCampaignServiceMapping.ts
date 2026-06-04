import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/meta-ads/lib/parseEdgeFunctionError";
import type { MetaAdsMetricsRow } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";
import { supabase } from "@/shared/lib/supabaseClient";

type UpsertPayload = {
  organizationId: string;
  adAccountId: string;
  campaignId: string;
  serviceId: string | null;
};

export function useMetaAdsCampaignServiceMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      adAccountId,
      campaignId,
      serviceId,
    }: UpsertPayload) => {
      const { data, error } = await supabase.functions.invoke("meta-ads-metrics", {
        body: {
          action: "upsertCampaignServiceMapping",
          organization_id: organizationId,
          ad_account_id: adAccountId.replace(/\D/g, ""),
          campaign_id: campaignId,
          service_id: serviceId ?? "",
        },
      });
      if (error) {
        throw await parseEdgeFunctionError(error, data);
      }
      const payload = data as { error?: string; mapping?: { service_name?: string } };
      if (payload?.error) throw new Error(payload.error);
      return payload;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-metrics"] });
      queryClient.invalidateQueries({
        queryKey: ["meta-ads-metrics", vars.organizationId],
      });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-report-by-service"] });
    },
  });
}

export function resolveCampaignIdFromMetaMetricsRow(row: MetaAdsMetricsRow): string {
  return String((row as Record<string, unknown>).campaign_id ?? "").trim();
}

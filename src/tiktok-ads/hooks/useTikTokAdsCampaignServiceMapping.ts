import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEdgeFunctionError } from "@/tiktok-ads/lib/parseEdgeFunctionError";
import type { TikTokAdsMetricsRow } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";
import { supabase } from "@/shared/lib/supabaseClient";

type UpsertPayload = {
  organizationId: string;
  advertiserId: string;
  campaignId: string;
  serviceId: string | null;
};

export function useTikTokAdsCampaignServiceMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      advertiserId,
      campaignId,
      serviceId,
    }: UpsertPayload) => {
      const { data, error } = await supabase.functions.invoke("tiktok-ads-metrics", {
        body: {
          action: "upsertCampaignServiceMapping",
          organization_id: organizationId,
          advertiser_id: advertiserId.replace(/\D/g, ""),
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
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-metrics"] });
      queryClient.invalidateQueries({
        queryKey: ["tiktok-ads-metrics", vars.organizationId],
      });
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-report-by-service"] });
    },
  });
}

export function resolveCampaignIdFromTikTokMetricsRow(row: TikTokAdsMetricsRow): string {
  return String((row as Record<string, unknown>).campaign_id ?? "").trim();
}

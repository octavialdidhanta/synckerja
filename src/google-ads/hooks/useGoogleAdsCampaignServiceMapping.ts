import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import { parseGoogleAdsResourceId } from "@/google-ads/metrics/parseGoogleAdsResourceId";
import type { GoogleAdsMetricsRow } from "@/google-ads/metrics/types";

type UpsertPayload = {
  organizationId: string;
  customerId: string;
  campaignId: string;
  serviceId: string | null;
};

export function useGoogleAdsCampaignServiceMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      customerId,
      campaignId,
      serviceId,
    }: UpsertPayload) => {
      const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
        body: {
          action: "upsertCampaignServiceMapping",
          organization_id: organizationId,
          customer_id: customerId.replace(/\D/g, "").slice(0, 10),
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
      queryClient.invalidateQueries({ queryKey: ["google-ads-metrics-v2"] });
      queryClient.invalidateQueries({
        queryKey: ["google-ads-metrics-v2", vars.organizationId],
      });
    },
  });
}

/** Resolve campaign resource id from a metrics table row. */
export function resolveCampaignIdFromMetricsRow(
  row: GoogleAdsMetricsRow,
  customerId: string,
): string {
  const rawId = String(row.id ?? "").trim();
  const composite = /^(\d{10})-(\d+)$/.exec(rawId);
  if (composite) return composite[2];
  return parseGoogleAdsResourceId(String(row.identity.campaign_id ?? row.id ?? ""));
}

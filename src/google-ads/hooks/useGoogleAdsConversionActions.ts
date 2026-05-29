import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type { GoogleAdsConversionActionOption } from "@/google-ads/metrics/types";

type ListResponse = {
  custom_columns: Array<{
    key: string;
    label: string;
    description: string;
    conversion_action_id: string;
    customer_id: string;
    account_label?: string | null;
  }>;
};

/** Conversion actions from Google Ads API (GAQL `conversion_action`). */
export function useGoogleAdsConversionActions(
  organizationId: string | null | undefined,
  customerId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["google-ads-conversion-actions", organizationId, customerId],
    queryFn: async (): Promise<GoogleAdsConversionActionOption[]> => {
      if (!organizationId || !customerId) return [];
      const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
        body: {
          organization_id: organizationId,
          action: "listCustomColumns",
          customer_id: customerId,
        },
      });
      if (error) throw await parseEdgeFunctionError(error, data);
      const payload = data as ListResponse & { error?: string };
      if (payload?.error) throw await parseEdgeFunctionError(null, payload);
      return (payload.custom_columns ?? []).map((col) => ({
        key: col.key,
        label: col.account_label ? `${col.account_label} · ${col.label}` : col.label,
        description: col.description,
      }));
    },
    enabled: Boolean(organizationId && customerId) && enabled,
    staleTime: 60 * 60 * 1000,
  });
}

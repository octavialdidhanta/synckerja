import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";

export type GoogleAdsAccountDateBounds = {
  earliest_date: string;
  latest_date: string;
};

async function fetchAccountDateBounds(
  organizationId: string,
  customerId: string,
): Promise<GoogleAdsAccountDateBounds> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: {
      action: "getAccountDateBounds",
      organization_id: organizationId,
      customer_id: customerId,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as GoogleAdsAccountDateBounds & { error?: string };
  if (payload?.error) {
    throw await parseEdgeFunctionError(null, payload);
  }
  return payload;
}

export function useGoogleAdsAccountDateBounds(
  organizationId: string | null | undefined,
  customerId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["google-ads-account-date-bounds", organizationId, customerId],
    queryFn: () => fetchAccountDateBounds(organizationId!, customerId!),
    enabled: Boolean(organizationId && customerId && enabled),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });
}

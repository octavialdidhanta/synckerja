import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type { GoogleAdsCampaignListItem } from "@/google-ads/metrics/filterTypes";

type ListCampaignsResponse = {
  campaigns: GoogleAdsCampaignListItem[];
};

async function fetchCampaignList(
  organizationId: string,
  customerId: string,
  statusFilter: "all" | "enabled_only",
): Promise<GoogleAdsCampaignListItem[]> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: {
      action: "listCampaigns",
      organization_id: organizationId,
      customer_id: customerId,
      status_filter: statusFilter,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as ListCampaignsResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload.campaigns ?? [];
}

export function useGoogleAdsCampaignList(
  organizationId: string | null | undefined,
  customerId: string | null | undefined,
  statusFilter: "all" | "enabled_only",
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["google-ads-campaign-list", organizationId, customerId, statusFilter],
    queryFn: () => fetchCampaignList(organizationId!, customerId!, statusFilter),
    enabled: Boolean(organizationId && customerId && enabled),
    staleTime: 5 * 60 * 1000,
  });
}

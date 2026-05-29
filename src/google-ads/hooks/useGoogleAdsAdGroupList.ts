import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { parseEdgeFunctionError } from "@/google-ads/lib/parseEdgeFunctionError";
import type { GoogleAdsAdGroupListItem } from "@/google-ads/metrics/filterTypes";

type ListAdGroupsResponse = {
  ad_groups: GoogleAdsAdGroupListItem[];
};

async function fetchAdGroupList(
  organizationId: string,
  customerId: string,
  campaignId: string,
  statusFilter: "all" | "enabled_only",
): Promise<GoogleAdsAdGroupListItem[]> {
  const { data, error } = await supabase.functions.invoke("google-ads-metrics", {
    body: {
      action: "listAdGroups",
      organization_id: organizationId,
      customer_id: customerId,
      campaign_id: campaignId,
      status_filter: statusFilter,
    },
  });
  if (error) throw await parseEdgeFunctionError(error, data);
  const payload = data as ListAdGroupsResponse & { error?: string };
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  return payload.ad_groups ?? [];
}

export function useGoogleAdsAdGroupList(
  organizationId: string | null | undefined,
  customerId: string | null | undefined,
  campaignId: string | null | undefined,
  statusFilter: "all" | "enabled_only",
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["google-ads-ad-group-list", organizationId, customerId, campaignId, statusFilter],
    queryFn: () => fetchAdGroupList(organizationId!, customerId!, campaignId!, statusFilter),
    enabled: Boolean(organizationId && customerId && campaignId && enabled),
    staleTime: 5 * 60 * 1000,
  });
}

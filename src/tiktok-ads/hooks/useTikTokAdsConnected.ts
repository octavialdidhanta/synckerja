import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

/** OAuth + advertiser account configured (sync column visibility). Uploads may still be toggled off. */
export function useTikTokAdsConnected(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["tiktok-ads-connected", organizationId],
    queryFn: async () => {
      if (!organizationId) return false;
      const { data, error } = await supabase.rpc("is_tiktok_ads_connected", {
        p_organization_id: organizationId,
      });
      if (error) {
        console.error("is_tiktok_ads_connected:", error.message);
        return false;
      }
      return data === true;
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

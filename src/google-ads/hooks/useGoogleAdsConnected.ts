import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

/** OAuth + account configured (sync column visibility). Uploads may still be toggled off. */
export function useGoogleAdsConnected(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["google-ads-connected", organizationId],
    queryFn: async () => {
      if (!organizationId) return false;
      const { data, error } = await supabase.rpc("is_google_ads_connected", {
        p_organization_id: organizationId,
      });
      if (error) {
        console.error("is_google_ads_connected:", error.message);
        return false;
      }
      return data === true;
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

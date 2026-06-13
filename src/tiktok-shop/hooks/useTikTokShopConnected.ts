import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

export function useTikTokShopConnected(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["tiktok-shop-connected", organizationId],
    queryFn: async () => {
      if (!organizationId) return false;
      const { data, error } = await supabase.rpc("is_tiktok_shop_connected", {
        p_organization_id: organizationId,
      });
      if (error) {
        console.error("is_tiktok_shop_connected:", error.message);
        return false;
      }
      return data === true;
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
}

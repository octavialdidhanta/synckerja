import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export const SYNCKERJA_ORDER_OUTLET_COVER_QUERY = "synckerja-order-outlet-cover";

export function useSynckerjaOrderOutletCover(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_OUTLET_COVER_QUERY, organizationId, outletId],
    queryFn: async (): Promise<string | null> => {
      if (!organizationId || !outletId) return null;
      const { data, error } = await supabase
        .from("synckerja_order_outlet_settings")
        .select("cover_path")
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .maybeSingle();
      if (error) throw error;
      const path = data?.cover_path ? String(data.cover_path).trim() : "";
      return path || null;
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (coverPath: string | null) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      // A new row keeps `enabled` at its default. This must not turn a branch on.
      const { error } = await supabase.from("synckerja_order_outlet_settings").upsert(
        {
          organization_id: organizationId,
          outlet_id: outletId,
          cover_path: coverPath,
        },
        { onConflict: "outlet_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SYNCKERJA_ORDER_OUTLET_COVER_QUERY, organizationId, outletId],
      });
    },
  });

  return { coverPath: query.data ?? null, isLoading: query.isLoading, save };
}

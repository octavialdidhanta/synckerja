import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeCoverPaths } from "@/synckerja-order/shared/lib/orderCoverSlides";

export const SYNCKERJA_ORDER_OUTLET_COVER_QUERY = "synckerja-order-outlet-cover";

type CoverRow = {
  cover_path?: string | null;
  cover_paths?: string[] | null;
};

export function useSynckerjaOrderOutletCover(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_OUTLET_COVER_QUERY, organizationId, outletId],
    queryFn: async (): Promise<string[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("synckerja_order_outlet_settings")
        .select("cover_path, cover_paths")
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .maybeSingle();
      if (error) throw error;
      const row = (data ?? null) as CoverRow | null;
      const listed = Array.isArray(row?.cover_paths) ? row.cover_paths : [];
      return normalizeCoverPaths(listed.length > 0 ? listed : row?.cover_path ? [row.cover_path] : []);
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (coverPaths: string[]) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      const next = normalizeCoverPaths(coverPaths);
      // A new row keeps `enabled` at its default. This must not turn a branch on.
      const { error } = await supabase.from("synckerja_order_outlet_settings").upsert(
        {
          organization_id: organizationId,
          outlet_id: outletId,
          cover_paths: next,
          cover_path: next[0] ?? null,
        },
        { onConflict: "outlet_id" },
      );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData([SYNCKERJA_ORDER_OUTLET_COVER_QUERY, organizationId, outletId], next);
    },
  });

  return { coverPaths: query.data ?? [], isLoading: query.isLoading, save };
}

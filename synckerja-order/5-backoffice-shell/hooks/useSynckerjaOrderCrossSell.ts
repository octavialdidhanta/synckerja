import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export const SYNCKERJA_ORDER_CROSS_SELL_QUERY = "synckerja-order-cross-sell";

export type SynckerjaOrderCrossSellRow = {
  from_category_id: string;
  to_category_id: string | null;
};

export function useSynckerjaOrderCrossSell() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_CROSS_SELL_QUERY, organizationId],
    queryFn: async (): Promise<Record<string, string>> => {
      if (!organizationId) return {};
      const { data, error } = await supabase
        .from("synckerja_order_cross_sell")
        .select("from_category_id, to_category_id")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.to_category_id) map[String(row.from_category_id)] = String(row.to_category_id);
      }
      return map;
    },
    enabled: Boolean(organizationId),
  });

  const save = useMutation({
    mutationFn: async (rows: SynckerjaOrderCrossSellRow[]) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { error: delErr } = await supabase
        .from("synckerja_order_cross_sell")
        .delete()
        .eq("organization_id", organizationId);
      if (delErr) throw delErr;
      const payload = rows
        .filter((row) => row.to_category_id)
        .map((row) => ({
          organization_id: organizationId,
          from_category_id: row.from_category_id,
          to_category_id: row.to_category_id,
        }));
      if (payload.length === 0) return;
      const { error } = await supabase.from("synckerja_order_cross_sell").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SYNCKERJA_ORDER_CROSS_SELL_QUERY, organizationId],
      });
    },
  });

  return { ...query, pairings: query.data ?? {}, save };
}

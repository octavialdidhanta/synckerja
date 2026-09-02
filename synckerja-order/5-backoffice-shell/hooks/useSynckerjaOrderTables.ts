import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type SynckerjaOrderTableRow = {
  id: string;
  name: string;
  pax: number;
  group_name: string | null;
};

export function useSynckerjaOrderTables(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ["synckerja-order-tables", organizationId, outletId],
    queryFn: async (): Promise<SynckerjaOrderTableRow[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_tables")
        .select("id, name, pax, group_id")
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .eq("is_deleted", false)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        pax: Number(row.pax ?? 1),
        group_name: null,
      }));
    },
    enabled: Boolean(organizationId && outletId),
  });
}

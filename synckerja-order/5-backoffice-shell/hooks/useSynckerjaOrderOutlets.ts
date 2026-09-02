import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { isValidPublicCode, normalizePublicCode } from "@/synckerja-order/shared/lib/publicCode";

export const SYNCKERJA_ORDER_OUTLETS_QUERY = "synckerja-order-outlets";

export type SynckerjaOrderOutletRow = {
  id: string;
  name: string;
  public_code: string | null;
  enabled: boolean;
  is_active: boolean;
};

export function useSynckerjaOrderOutlets() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_OUTLETS_QUERY, organizationId],
    queryFn: async (): Promise<SynckerjaOrderOutletRow[]> => {
      if (!organizationId) return [];
      const { data: outlets, error } = await supabase
        .from("pos_outlets")
        .select("id, name, public_code, is_active")
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const { data: settings } = await supabase
        .from("synckerja_order_outlet_settings")
        .select("outlet_id, enabled")
        .eq("organization_id", organizationId);
      const enabled = new Map(
        (settings ?? []).map((row) => [String(row.outlet_id), Boolean(row.enabled)]),
      );
      return (outlets ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ""),
        public_code: row.public_code ? String(row.public_code) : null,
        enabled: enabled.get(String(row.id)) ?? false,
        is_active: Boolean(row.is_active),
      }));
    },
    enabled: Boolean(organizationId),
  });

  const saveOutlet = useMutation({
    mutationFn: async (args: { outletId: string; enabled?: boolean; publicCode?: string }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      if (args.publicCode != null) {
        const code = normalizePublicCode(args.publicCode);
        if (!isValidPublicCode(code)) throw new Error("invalid_public_code");
        const { error } = await supabase
          .from("pos_outlets")
          .update({ public_code: code })
          .eq("id", args.outletId)
          .eq("organization_id", organizationId);
        if (error) throw error;
      }
      if (args.enabled != null) {
        const { error } = await supabase.from("synckerja_order_outlet_settings").upsert(
          {
            organization_id: organizationId,
            outlet_id: args.outletId,
            enabled: args.enabled,
          },
          { onConflict: "outlet_id" },
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [SYNCKERJA_ORDER_OUTLETS_QUERY, organizationId] });
    },
  });

  return { ...query, rows: query.data ?? [], saveOutlet };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export const POS_LINE_VOIDS_QUERY_KEY = "pos-line-voids";

export type PosLineVoid = {
  id: string;
  organization_id: string;
  outlet_id: string;
  session_id: string | null;
  catalog_item_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  reason: string;
  voided_by: string | null;
  created_at: string;
  voided_by_name?: string;
};

export function usePosLineVoids(outletId: string | null | undefined) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && outletId);

  const query = useQuery({
    queryKey: [POS_LINE_VOIDS_QUERY_KEY, organizationId, outletId],
    enabled,
    queryFn: async (): Promise<PosLineVoid[]> => {
      if (!organizationId || !outletId) return [];
      const { data, error } = await supabase
        .from("pos_line_voids")
        .select(
          "id, organization_id, outlet_id, session_id, catalog_item_id, product_name, quantity, unit_price, reason, voided_by, created_at",
        )
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as PosLineVoid[];
      const userIds = [...new Set(rows.map((r) => r.voided_by).filter(Boolean))] as string[];
      const nameByUser = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        for (const p of profiles ?? []) {
          nameByUser.set(
            String(p.user_id),
            String(p.full_name ?? "").trim() || "—",
          );
        }
      }
      return rows.map((r) => ({
        ...r,
        quantity: Number(r.quantity) || 0,
        unit_price: Number(r.unit_price) || 0,
        voided_by_name: r.voided_by ? (nameByUser.get(r.voided_by) ?? "—") : "—",
      }));
    },
  });

  const insertVoid = useMutation({
    mutationFn: async (payload: {
      outletId: string;
      sessionId?: string | null;
      catalogItemId?: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      reason: string;
    }): Promise<void> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("pos_line_voids").insert({
        organization_id: organizationId,
        outlet_id: payload.outletId,
        session_id: payload.sessionId ?? null,
        catalog_item_id: payload.catalogItemId ?? null,
        product_name: payload.productName,
        quantity: payload.quantity,
        unit_price: payload.unitPrice,
        reason: payload.reason.trim(),
        voided_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (!organizationId || !outletId) return;
      void queryClient.invalidateQueries({
        queryKey: [POS_LINE_VOIDS_QUERY_KEY, organizationId, outletId],
      });
    },
  });

  return {
    voids: query.data ?? [],
    isLoading: enabled ? query.isLoading : false,
    insertVoid,
  };
}

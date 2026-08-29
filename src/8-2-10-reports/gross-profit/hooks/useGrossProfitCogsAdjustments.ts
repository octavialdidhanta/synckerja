import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { GrossProfitCogsAdjustment } from "../lib/grossProfitCogsAdjustmentTypes";

export const GROSS_PROFIT_COGS_ADJUSTMENTS_QUERY_KEY = "pos-gross-profit-cogs-adjustments";

function mapRow(row: Record<string, unknown>): GrossProfitCogsAdjustment {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    posOutletId: row.pos_outlet_id != null ? String(row.pos_outlet_id) : null,
    amount: Number(row.amount ?? 0),
    reason: row.reason != null ? String(row.reason) : null,
    adjustmentDate: String(row.adjustment_date ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

export function useGrossProfitCogsAdjustments(args: {
  outletId: string | null;
  fromYmd: string;
  toYmd: string;
  enabled?: boolean;
}) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled !== false && organizationId && args.fromYmd && args.toYmd,
  );

  return useQuery({
    queryKey: [
      GROSS_PROFIT_COGS_ADJUSTMENTS_QUERY_KEY,
      organizationId,
      args.outletId,
      args.fromYmd,
      args.toYmd,
    ],
    enabled: enabled && !orgLoading,
    queryFn: async (): Promise<GrossProfitCogsAdjustment[]> => {
      let q = supabase
        .from("pos_gross_profit_cogs_adjustments")
        .select("id, organization_id, pos_outlet_id, amount, reason, adjustment_date, created_at")
        .eq("organization_id", organizationId!)
        .gte("adjustment_date", args.fromYmd)
        .lte("adjustment_date", args.toYmd)
        .order("adjustment_date", { ascending: false });

      if (args.outletId) {
        q = q.or(`pos_outlet_id.is.null,pos_outlet_id.eq.${args.outletId}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
    },
  });
}

export function useGrossProfitCogsAdjustmentMutations() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [GROSS_PROFIT_COGS_ADJUSTMENTS_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["pos-gross-profit-report"] }),
      queryClient.invalidateQueries({ queryKey: ["pos-gross-profit-daily"] }),
    ]);
  };

  const create = useMutation({
    mutationFn: async (payload: {
      amount: number;
      reason: string;
      adjustmentDate: string;
      posOutletId: string | null;
    }) => {
      if (!organizationId) throw new Error("No organization");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("pos_gross_profit_cogs_adjustments").insert({
        organization_id: organizationId,
        pos_outlet_id: payload.posOutletId,
        amount: payload.amount,
        reason: payload.reason.trim() || null,
        adjustment_date: payload.adjustmentDate,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pos_gross_profit_cogs_adjustments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, remove };
}

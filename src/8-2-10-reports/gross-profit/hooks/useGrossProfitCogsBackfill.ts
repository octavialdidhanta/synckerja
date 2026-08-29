import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type GrossProfitCogsBackfillResult = {
  updatedCount: number;
  skippedCount: number;
};

export function useGrossProfitCogsBackfill() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (outletId: string | null): Promise<GrossProfitCogsBackfillResult> => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { data, error } = await supabase.rpc("pos_backfill_sales_item_unit_cogs", {
        p_organization_id: organizationId,
        p_outlet_id: outletId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const r = (row ?? {}) as Record<string, unknown>;
      return {
        updatedCount: Number(r.updated_count ?? 0) || 0,
        skippedCount: Number(r.skipped_count ?? 0) || 0,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pos-gross-profit-report"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-gross-profit-by-item"] });
      void queryClient.invalidateQueries({ queryKey: ["pos-gross-profit-daily"] });
    },
  });

  return {
    backfill: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

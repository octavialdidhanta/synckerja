import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeGrossProfitItemRows } from "../lib/computeGrossProfitItemsDisplay";
import type { GrossProfitItemRow } from "../lib/grossProfitItemTypes";

export type UseGrossProfitItemsArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  categoryId?: string | null;
  enabled?: boolean;
};

export function useGrossProfitItems(args: UseGrossProfitItemsArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const query = useQuery({
    queryKey: [
      "pos-gross-profit-by-item",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
      args.categoryId ?? null,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GrossProfitItemRow[]> => {
      const { data, error } = await supabase.rpc("pos_gross_profit_by_item", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
        p_category_id: args.categoryId ?? null,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return normalizeGrossProfitItemRows(rows as Array<Partial<Record<string, unknown>>>);
    },
  });

  return {
    items: query.data ?? [],
    isLoading: orgLoading || (enabled && query.isLoading),
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

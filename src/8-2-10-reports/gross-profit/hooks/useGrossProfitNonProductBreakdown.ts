import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeGrossProfitNonProductRows } from "../lib/computeGrossProfitNonProductDisplay";
import type { GrossProfitNonProductRow } from "../lib/grossProfitNonProductTypes";

export type UseGrossProfitNonProductBreakdownArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useGrossProfitNonProductBreakdown(args: UseGrossProfitNonProductBreakdownArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const query = useQuery({
    queryKey: [
      "pos-gross-profit-non-product-breakdown",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GrossProfitNonProductRow[]> => {
      const { data, error } = await supabase.rpc("pos_gross_profit_non_product_breakdown", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return normalizeGrossProfitNonProductRows(rows as Array<Partial<Record<string, unknown>>>);
    },
  });

  return {
    rows: query.data ?? [],
    isLoading: orgLoading || (enabled && query.isLoading),
    isError: query.isError,
    error: query.error,
  };
}

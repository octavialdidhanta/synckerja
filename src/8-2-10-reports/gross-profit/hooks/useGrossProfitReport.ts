import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeGrossProfitMetrics } from "../lib/computeGrossProfitDisplay";
import { EMPTY_GROSS_PROFIT, type GrossProfitMetrics } from "../lib/grossProfitTypes";

export type UseGrossProfitReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useGrossProfitReport(args: UseGrossProfitReportArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const query = useQuery({
    queryKey: [
      "pos-gross-profit-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GrossProfitMetrics> => {
      const { data, error } = await supabase.rpc("pos_gross_profit_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return normalizeGrossProfitMetrics(row as Partial<Record<string, unknown>> | null);
    },
  });

  return {
    metrics: query.data ?? EMPTY_GROSS_PROFIT,
    isLoading: orgLoading || (enabled && query.isLoading),
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    organizationId: organizationId ?? null,
  };
}

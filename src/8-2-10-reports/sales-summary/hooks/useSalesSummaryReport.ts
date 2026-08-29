import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeSalesSummaryMetrics } from "../lib/computeSalesSummaryDisplay";
import { EMPTY_SALES_SUMMARY, type SalesSummaryMetrics } from "../lib/salesSummaryTypes";

export type UseSalesSummaryReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useSalesSummaryReport(args: UseSalesSummaryReportArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const query = useQuery({
    queryKey: [
      "pos-sales-summary-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    queryFn: async (): Promise<SalesSummaryMetrics> => {
      const { data, error } = await supabase.rpc("pos_sales_summary_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return normalizeSalesSummaryMetrics(row as Partial<Record<string, unknown>> | null);
    },
  });

  return {
    metrics: query.data ?? EMPTY_SALES_SUMMARY,
    isLoading: orgLoading || (enabled && query.isLoading),
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    organizationId: organizationId ?? null,
  };
}

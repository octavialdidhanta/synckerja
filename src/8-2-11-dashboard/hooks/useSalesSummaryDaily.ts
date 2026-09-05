import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type SalesSummaryDailyPoint = {
  day: string;
  grossSales: number;
  netSales: number;
  totalCollected: number;
  refunds: number;
};

export type UseSalesSummaryDailyArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
  refetchInterval?: number | false;
};

function mapDailyRow(row: Record<string, unknown>): SalesSummaryDailyPoint {
  const dayRaw = row.day;
  const day =
    typeof dayRaw === "string"
      ? dayRaw.slice(0, 10)
      : dayRaw instanceof Date
        ? dayRaw.toISOString().slice(0, 10)
        : String(dayRaw ?? "").slice(0, 10);
  const num = (key: string) => {
    const v = Number(row[key] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    day,
    grossSales: row.gross_sales == null ? num("net_sales") : num("gross_sales"),
    netSales: num("net_sales"),
    totalCollected: num("total_collected"),
    refunds: num("refunds"),
  };
}

export function useSalesSummaryDaily(args: UseSalesSummaryDailyArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const query = useQuery({
    queryKey: [
      "pos-sales-summary-daily",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    refetchInterval: args.refetchInterval,
    queryFn: async (): Promise<SalesSummaryDailyPoint[]> => {
      const { data, error } = await supabase.rpc("pos_sales_summary_daily", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return rows.map((r) => mapDailyRow(r as Record<string, unknown>));
    },
  });

  return {
    points: query.data ?? [],
    isLoading: orgLoading || (enabled && query.isLoading),
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";

export type GrossProfitDailyPoint = {
  day: string;
  netSales: number;
  cogs: number;
  grossProfit: number;
};

export type UseGrossProfitDailyArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

function mapDailyRow(row: Record<string, unknown>): GrossProfitDailyPoint {
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
    netSales: num("net_sales"),
    cogs: num("cogs"),
    grossProfit: num("gross_profit"),
  };
}

export function useGrossProfitDaily(args: UseGrossProfitDailyArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const query = useQuery({
    queryKey: [
      "pos-gross-profit-daily",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<GrossProfitDailyPoint[]> => {
      const { data, error } = await supabase.rpc("pos_gross_profit_daily", {
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

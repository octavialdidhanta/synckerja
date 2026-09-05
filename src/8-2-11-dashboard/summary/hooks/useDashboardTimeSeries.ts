import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { useSalesSummaryDaily } from "../../hooks/useSalesSummaryDaily";

export type UseDashboardTimeSeriesArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function finiteNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

/** Ensure Sun–Sat axis even when RPC omits empty days. */
export function spineDowGross(
  rows: Array<{ dow: number; label: string; grossSales: number }>,
): Array<{ dow: number; label: string; grossSales: number }> {
  const byDow = new Map(rows.map((row) => [row.dow, row.grossSales]));
  return DOW_LABELS.map((label, dow) => ({
    dow,
    label,
    grossSales: byDow.get(dow) ?? 0,
  }));
}

/** Ensure hours 0–23 even when RPC omits empty hours. */
export function spineHourlyGross(
  rows: Array<{ hour: number; grossSales: number }>,
): Array<{ hour: number; grossSales: number }> {
  const byHour = new Map(rows.map((row) => [row.hour, row.grossSales]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    grossSales: byHour.get(hour) ?? 0,
  }));
}

export function useDashboardTimeSeries(args: UseDashboardTimeSeriesArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(
    args.enabled !== false && organizationId && args.fromIso && args.toIso && !orgLoading,
  );
  const daily = useSalesSummaryDaily({ ...args, refetchInterval: 60_000 });
  const rpcArgs = {
    p_organization_id: organizationId!,
    p_outlet_id: args.outletId,
    p_from: args.fromIso,
    p_to: args.toIso,
  };
  const dow = useQuery({
    queryKey: ["pos-dashboard-gross-by-dow", organizationId, args.outletId, args.fromIso, args.toIso],
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_dashboard_gross_by_dow", rpcArgs);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return rows.map((row) => {
        const record = row as Record<string, unknown>;
        const day = finiteNumber(record.dow);
        return {
          dow: day,
          label: DOW_LABELS[day] ?? String(day),
          grossSales: finiteNumber(record.gross_sales),
        };
      });
    },
  });
  const hourly = useQuery({
    queryKey: ["pos-dashboard-gross-by-hour", organizationId, args.outletId, args.fromIso, args.toIso],
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_dashboard_gross_by_hour", rpcArgs);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      return rows.map((row) => {
        const record = row as Record<string, unknown>;
        return {
          hour: finiteNumber(record.hour),
          grossSales: finiteNumber(record.gross_sales),
        };
      });
    },
  });

  return {
    dailyPoints: daily.points,
    dowPoints: spineDowGross(dow.data ?? []),
    hourlyPoints: spineHourlyGross(hourly.data ?? []),
    isLoading: daily.isLoading || orgLoading || (enabled && (dow.isLoading || hourly.isLoading)),
    isFetching: daily.isFetching || dow.isFetching || hourly.isFetching,
    isError: daily.isError || dow.isError || hourly.isError,
    error: daily.error ?? dow.error ?? hourly.error,
  };
}

export type DashboardDowPoint = ReturnType<typeof useDashboardTimeSeries>["dowPoints"][number];
export type DashboardHourlyPoint = ReturnType<typeof useDashboardTimeSeries>["hourlyPoints"][number];

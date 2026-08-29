import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildServedBySalesDisplay } from "../lib/computeServedBySalesDisplay";
import {
  EMPTY_SERVED_BY_SALES_DISPLAY,
  type ServedBySalesDisplay,
} from "../lib/servedBySalesTypes";

export type UseServedBySalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function useServedBySalesReport(args: UseServedBySalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const serverQuery = useQuery({
    queryKey: [
      "pos-served-by-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_served_by_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const salesTypeQuery = useQuery({
    queryKey: [
      "pos-served-by-sales-by-sales-type",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_served_by_sales_by_sales_type", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const summaryQuery = useQuery({
    queryKey: [
      "pos-sales-summary-served-by-check",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_sales_summary_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as Partial<Record<string, unknown>> | null;
    },
  });

  const unknownServerLabel = t("reports.servedBySales.unknownServer", "Unknown Server");

  const display: ServedBySalesDisplay = useMemo(() => {
    if (!serverQuery.data) return EMPTY_SERVED_BY_SALES_DISPLAY;
    return buildServedBySalesDisplay({
      serverRowsRaw: serverQuery.data as Array<Partial<Record<string, unknown>>>,
      salesTypeRowsRaw: (salesTypeQuery.data ?? []) as Array<Partial<Record<string, unknown>>>,
      unknownServerLabel,
    });
  }, [serverQuery.data, salesTypeQuery.data, unknownServerLabel]);

  const salesSummaryGrossSales = useMemo(
    () => num(summaryQuery.data ?? undefined, "gross_sales"),
    [summaryQuery.data],
  );

  const salesSummaryNetSales = useMemo(
    () => num(summaryQuery.data ?? undefined, "net_sales"),
    [summaryQuery.data],
  );

  const reconciliationDeltaGross = useMemo(
    () => Math.abs(display.grandTotal.grossSales - salesSummaryGrossSales),
    [display.grandTotal.grossSales, salesSummaryGrossSales],
  );

  const reconciliationDeltaNet = useMemo(
    () => Math.abs(display.grandTotal.netSales - salesSummaryNetSales),
    [display.grandTotal.netSales, salesSummaryNetSales],
  );

  const isLoading =
    orgLoading ||
    (enabled &&
      ((serverQuery.isLoading && !serverQuery.data) ||
        (salesTypeQuery.isLoading && !salesTypeQuery.data)));

  return {
    display,
    salesSummaryGrossSales,
    salesSummaryNetSales,
    reconciliationDeltaGross,
    reconciliationDeltaNet,
    isLoading,
    isFetching: serverQuery.isFetching || salesTypeQuery.isFetching || summaryQuery.isFetching,
    isError: serverQuery.isError || salesTypeQuery.isError,
    error: serverQuery.error ?? salesTypeQuery.error,
    refetch: async () => {
      await Promise.all([
        serverQuery.refetch(),
        salesTypeQuery.refetch(),
        summaryQuery.refetch(),
      ]);
    },
  };
}

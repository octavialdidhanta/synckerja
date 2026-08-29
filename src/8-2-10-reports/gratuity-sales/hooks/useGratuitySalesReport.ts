import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildGratuitySalesDisplay } from "../lib/computeGratuitySalesDisplay";
import {
  EMPTY_GRATUITY_SALES_DISPLAY,
  type GratuitySalesDisplay,
} from "../lib/gratuitySalesTypes";

export type UseGratuitySalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function useGratuitySalesReport(args: UseGratuitySalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const gratuityQuery = useQuery({
    queryKey: [
      "pos-gratuity-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_gratuity_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const rateQuery = useQuery({
    queryKey: [
      "pos-gratuity-sales-by-rate",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_gratuity_sales_by_rate", {
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
      "pos-sales-summary-gratuity-check",
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

  const unknownGratuityLabel = t("reports.gratuitySales.unknownGratuity", "Unknown");

  const display: GratuitySalesDisplay = useMemo(() => {
    if (!gratuityQuery.data && !rateQuery.data) return EMPTY_GRATUITY_SALES_DISPLAY;
    return buildGratuitySalesDisplay({
      gratuityRowsRaw: gratuityQuery.data as Array<Partial<Record<string, unknown>>>,
      rateRowsRaw: rateQuery.data as Array<Partial<Record<string, unknown>>>,
      unknownGratuityLabel,
    });
  }, [gratuityQuery.data, rateQuery.data, unknownGratuityLabel]);

  const salesSummaryGratuityTotal = useMemo(
    () => num(summaryQuery.data ?? undefined, "gratuity"),
    [summaryQuery.data],
  );

  const reconciliationDelta = useMemo(
    () => Math.abs(display.grandTotal.netGratuity - salesSummaryGratuityTotal),
    [display.grandTotal.netGratuity, salesSummaryGratuityTotal],
  );

  const reportNetGratuityCollected = display.grandTotal.netGratuity;

  const isLoading =
    orgLoading ||
    (enabled &&
      ((gratuityQuery.isLoading && !gratuityQuery.data) ||
        (rateQuery.isLoading && !rateQuery.data)));

  return {
    display,
    salesSummaryGratuityTotal,
    reportNetGratuityCollected,
    reconciliationDelta,
    isLoading,
    isFetching:
      gratuityQuery.isFetching || rateQuery.isFetching || summaryQuery.isFetching,
    isError: gratuityQuery.isError || rateQuery.isError,
    error: gratuityQuery.error ?? rateQuery.error,
    refetch: async () => {
      await Promise.all([
        gratuityQuery.refetch(),
        rateQuery.refetch(),
        summaryQuery.refetch(),
      ]);
    },
  };
}

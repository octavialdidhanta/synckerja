import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildTaxSalesDisplay } from "../lib/computeTaxSalesDisplay";
import { EMPTY_TAX_SALES_DISPLAY, type TaxSalesDisplay } from "../lib/taxSalesTypes";

export type UseTaxSalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function useTaxSalesReport(args: UseTaxSalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const taxQuery = useQuery({
    queryKey: ["pos-tax-sales-report", organizationId, args.outletId, args.fromIso, args.toIso],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_tax_sales_report", {
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
    queryKey: ["pos-tax-sales-by-rate", organizationId, args.outletId, args.fromIso, args.toIso],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_tax_sales_by_rate", {
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
      "pos-sales-summary-tax-check",
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

  const unknownTaxLabel = t("reports.taxSales.unknownTax", "Unknown");

  const display: TaxSalesDisplay = useMemo(() => {
    if (!taxQuery.data && !rateQuery.data) return EMPTY_TAX_SALES_DISPLAY;
    return buildTaxSalesDisplay({
      taxRowsRaw: taxQuery.data as Array<Partial<Record<string, unknown>>>,
      rateRowsRaw: rateQuery.data as Array<Partial<Record<string, unknown>>>,
      unknownTaxLabel,
    });
  }, [taxQuery.data, rateQuery.data, unknownTaxLabel]);

  const salesSummaryTaxTotal = useMemo(
    () => num(summaryQuery.data ?? undefined, "tax"),
    [summaryQuery.data],
  );

  const reconciliationDelta = useMemo(
    () => Math.abs(display.grandTotal.netTax - salesSummaryTaxTotal),
    [display.grandTotal.netTax, salesSummaryTaxTotal],
  );

  const reportNetTaxCollected = display.grandTotal.netTax;

  const isLoading =
    orgLoading ||
    (enabled &&
      ((taxQuery.isLoading && !taxQuery.data) || (rateQuery.isLoading && !rateQuery.data)));

  return {
    display,
    salesSummaryTaxTotal,
    reportNetTaxCollected,
    reconciliationDelta,
    isLoading,
    isFetching: taxQuery.isFetching || rateQuery.isFetching || summaryQuery.isFetching,
    isError: taxQuery.isError || rateQuery.isError,
    error: taxQuery.error ?? rateQuery.error,
    refetch: async () => {
      await Promise.all([taxQuery.refetch(), rateQuery.refetch(), summaryQuery.refetch()]);
    },
  };
}

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildDiscountSalesDisplay } from "../lib/computeDiscountSalesDisplay";
import {
  EMPTY_DISCOUNT_SALES_DISPLAY,
  type DiscountSalesDisplay,
} from "../lib/discountSalesTypes";

export type UseDiscountSalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function useDiscountSalesReport(args: UseDiscountSalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const discountQuery = useQuery({
    queryKey: [
      "pos-discount-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_discount_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const valueQuery = useQuery({
    queryKey: [
      "pos-discount-sales-by-value",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_discount_sales_by_value", {
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
      "pos-sales-summary-discounts-check",
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

  const unknownDiscountLabel = t("reports.discountSales.unknownDiscount", "Unknown");

  const display: DiscountSalesDisplay = useMemo(() => {
    if (!discountQuery.data && !valueQuery.data) return EMPTY_DISCOUNT_SALES_DISPLAY;
    return buildDiscountSalesDisplay({
      discountRowsRaw: discountQuery.data as Array<Partial<Record<string, unknown>>>,
      valueRowsRaw: valueQuery.data as Array<Partial<Record<string, unknown>>>,
      unknownDiscountLabel,
    });
  }, [discountQuery.data, valueQuery.data, unknownDiscountLabel]);

  const salesSummaryDiscountTotal = useMemo(
    () => num(summaryQuery.data ?? undefined, "discounts"),
    [summaryQuery.data],
  );

  const reconciliationDelta = useMemo(
    () => Math.abs(display.grandTotal.netDiscount - salesSummaryDiscountTotal),
    [display.grandTotal.netDiscount, salesSummaryDiscountTotal],
  );

  const isLoading =
    orgLoading ||
    (enabled &&
      ((discountQuery.isLoading && !discountQuery.data) ||
        (valueQuery.isLoading && !valueQuery.data)));

  return {
    display,
    salesSummaryDiscountTotal,
    reconciliationDelta,
    isLoading,
    isFetching: discountQuery.isFetching || valueQuery.isFetching || summaryQuery.isFetching,
    isError: discountQuery.isError || valueQuery.isError,
    error: discountQuery.error ?? valueQuery.error,
    refetch: async () => {
      await Promise.all([discountQuery.refetch(), valueQuery.refetch(), summaryQuery.refetch()]);
    },
  };
}

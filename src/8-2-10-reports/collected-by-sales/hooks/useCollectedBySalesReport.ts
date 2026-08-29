import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildCollectedBySalesDisplay } from "../lib/computeCollectedBySalesDisplay";
import {
  EMPTY_COLLECTED_BY_SALES_DISPLAY,
  type CollectedBySalesDisplay,
} from "../lib/collectedBySalesTypes";

export type UseCollectedBySalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

function num(row: Partial<Record<string, unknown>> | undefined, key: string): number {
  const v = Number(row?.[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

export function useCollectedBySalesReport(args: UseCollectedBySalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const staffQuery = useQuery({
    queryKey: [
      "pos-collected-by-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_collected_by_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const paymentQuery = useQuery({
    queryKey: [
      "pos-collected-by-sales-by-payment",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_collected_by_sales_by_payment", {
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
      "pos-sales-summary-collected-by-check",
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

  const unknownStaffLabel = t("reports.collectedBySales.unknownStaff", "Unknown Staff");

  const display: CollectedBySalesDisplay = useMemo(() => {
    if (!staffQuery.data) return EMPTY_COLLECTED_BY_SALES_DISPLAY;
    return buildCollectedBySalesDisplay({
      staffRowsRaw: staffQuery.data as Array<Partial<Record<string, unknown>>>,
      paymentRowsRaw: (paymentQuery.data ?? []) as Array<Partial<Record<string, unknown>>>,
      unknownStaffLabel,
    });
  }, [staffQuery.data, paymentQuery.data, unknownStaffLabel]);

  const salesSummaryTotalCollected = useMemo(
    () => num(summaryQuery.data ?? undefined, "total_collected"),
    [summaryQuery.data],
  );

  const reconciliationDelta = useMemo(
    () => Math.abs(display.grandTotal.totalCollected - salesSummaryTotalCollected),
    [display.grandTotal.totalCollected, salesSummaryTotalCollected],
  );

  const isLoading =
    orgLoading ||
    (enabled &&
      ((staffQuery.isLoading && !staffQuery.data) ||
        (paymentQuery.isLoading && !paymentQuery.data)));

  return {
    display,
    salesSummaryTotalCollected,
    reconciliationDelta,
    isLoading,
    isFetching: staffQuery.isFetching || paymentQuery.isFetching || summaryQuery.isFetching,
    isError: staffQuery.isError || paymentQuery.isError,
    error: staffQuery.error ?? paymentQuery.error,
    refetch: async () => {
      await Promise.all([
        staffQuery.refetch(),
        paymentQuery.refetch(),
        summaryQuery.refetch(),
      ]);
    },
  };
}

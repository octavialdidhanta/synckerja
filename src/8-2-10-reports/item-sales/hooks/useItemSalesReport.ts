import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildItemSalesDisplay } from "../lib/computeItemSalesDisplay";
import { EMPTY_ITEM_SALES_DISPLAY, type ItemSalesDisplay } from "../lib/itemSalesTypes";

export type UseItemSalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  categoryId?: string | null;
  enabled?: boolean;
};

export function useItemSalesReport(args: UseItemSalesReportArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const reportQuery = useQuery({
    queryKey: [
      "pos-item-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
      args.categoryId ?? null,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_item_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
        p_category_id: args.categoryId ?? null,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const display: ItemSalesDisplay = useMemo(() => {
    if (!reportQuery.data) return EMPTY_ITEM_SALES_DISPLAY;
    return buildItemSalesDisplay(reportQuery.data as Array<Partial<Record<string, unknown>>>);
  }, [reportQuery.data]);

  const isLoading =
    orgLoading || (enabled && reportQuery.isLoading && !reportQuery.data);

  return {
    display,
    isLoading,
    isFetching: reportQuery.isFetching,
    isError: reportQuery.isError,
    error: reportQuery.error,
    refetch: reportQuery.refetch,
  };
}

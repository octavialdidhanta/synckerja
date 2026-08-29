import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { buildCategorySalesDisplay } from "../lib/computeCategorySalesDisplay";
import {
  EMPTY_CATEGORY_SALES_DISPLAY,
  type CategorySalesDisplay,
} from "../lib/categorySalesTypes";

export type UseCategorySalesReportArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useCategorySalesReport(args: UseCategorySalesReportArgs) {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const enabled = Boolean(args.enabled !== false && organizationId && args.fromIso && args.toIso);

  const reportQuery = useQuery({
    queryKey: [
      "pos-category-sales-report",
      organizationId,
      args.outletId,
      args.fromIso,
      args.toIso,
    ],
    enabled: enabled && !orgLoading,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_category_sales_report", {
        p_organization_id: organizationId!,
        p_outlet_id: args.outletId,
        p_from: args.fromIso,
        p_to: args.toIso,
      });
      if (error) throw error;
      return Array.isArray(data) ? data : data ? [data] : [];
    },
  });

  const uncategorizedLabel = t("reports.categorySales.uncategorized", "Uncategorized");

  const display: CategorySalesDisplay = useMemo(() => {
    if (!reportQuery.data) return EMPTY_CATEGORY_SALES_DISPLAY;
    return buildCategorySalesDisplay(
      reportQuery.data as Array<Partial<Record<string, unknown>>>,
      uncategorizedLabel,
    );
  }, [reportQuery.data, uncategorizedLabel]);

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

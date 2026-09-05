import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePosOutlets } from "@/8-2-2-outlets";
import { normalizeGrossProfitMetrics } from "@/8-2-10-reports/gross-profit/lib/computeGrossProfitDisplay";
import { EMPTY_GROSS_PROFIT } from "@/8-2-10-reports/gross-profit/lib/grossProfitTypes";
import { buildItemSalesDisplay } from "@/8-2-10-reports/item-sales/lib/computeItemSalesDisplay";
import { normalizeSalesSummaryMetrics } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import { EMPTY_SALES_SUMMARY } from "@/8-2-10-reports/sales-summary/lib/salesSummaryTypes";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { averageSalePerTransaction } from "../../shared/lib/dashboardMetricFormat";

export type UseDashboardOutletComparisonArgs = {
  outletIds: string[];
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export type DashboardOutletComparisonRow = {
  outletId: string;
  outletName: string;
  grossSales: number;
  netSales: number;
  grossProfit: number;
  transactionCount: number;
  avgSale: number;
  grossMargin: number;
  topItems: Array<{ name: string; qtySold: number }>;
};

export type DashboardComparisonMetricKey =
  | "grossSales"
  | "netSales"
  | "grossProfit"
  | "transactionCount"
  | "avgSale"
  | "grossMargin";

export function useDashboardOutletComparison(args: UseDashboardOutletComparisonArgs) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const { rows: outlets } = usePosOutlets();
  const outletIds = useMemo(
    () => Array.from(new Set(args.outletIds)).slice(0, 5),
    [args.outletIds],
  );
  const enabled = Boolean(
    args.enabled !== false
      && organizationId
      && args.fromIso
      && args.toIso
      && outletIds.length >= 2,
  );

  const queries = useQueries({
    queries: outletIds.map((outletId) => ({
      queryKey: [
        "pos-dashboard-outlet-comparison",
        organizationId,
        outletId,
        args.fromIso,
        args.toIso,
      ] as const,
      enabled: enabled && !orgLoading,
      placeholderData: keepPreviousData,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
      queryFn: async (): Promise<Omit<DashboardOutletComparisonRow, "outletName">> => {
        const [salesRes, profitRes, itemsRes] = await Promise.all([
          supabase.rpc("pos_sales_summary_report", {
            p_organization_id: organizationId!,
            p_outlet_id: outletId,
            p_from: args.fromIso,
            p_to: args.toIso,
          }),
          supabase.rpc("pos_gross_profit_report", {
            p_organization_id: organizationId!,
            p_outlet_id: outletId,
            p_from: args.fromIso,
            p_to: args.toIso,
          }),
          supabase.rpc("pos_item_sales_report", {
            p_organization_id: organizationId!,
            p_outlet_id: outletId,
            p_from: args.fromIso,
            p_to: args.toIso,
            p_category_id: null,
          }),
        ]);
        if (salesRes.error) throw salesRes.error;
        if (profitRes.error) throw profitRes.error;
        if (itemsRes.error) throw itemsRes.error;

        const salesRow = Array.isArray(salesRes.data) ? salesRes.data[0] : salesRes.data;
        const profitRow = Array.isArray(profitRes.data) ? profitRes.data[0] : profitRes.data;
        const sales = normalizeSalesSummaryMetrics(
          (salesRow as Partial<Record<string, unknown>> | null) ?? null,
        );
        const profit = normalizeGrossProfitMetrics(
          (profitRow as Partial<Record<string, unknown>> | null) ?? null,
        );
        const itemsRaw = Array.isArray(itemsRes.data)
          ? itemsRes.data
          : itemsRes.data
            ? [itemsRes.data]
            : [];
        const items = buildItemSalesDisplay(
          itemsRaw as Array<Partial<Record<string, unknown>>>,
        );
        const topItems = [...items.rows]
          .sort((a, b) => b.qtySold - a.qtySold)
          .slice(0, 3)
          .map((row) => ({
            name: row.variantName
              ? `${row.itemName} (${row.variantName})`
              : row.itemName,
            qtySold: row.qtySold,
          }));

        return {
          outletId,
          grossSales: sales.grossSales,
          netSales: sales.netSales,
          grossProfit: profit.grossProfit,
          transactionCount: sales.transactionCount,
          avgSale: averageSalePerTransaction(sales.netSales, sales.transactionCount),
          grossMargin: profit.grossProfitMargin,
          topItems,
        };
      },
    })),
  });

  const outletNameById = useMemo(() => {
    return new Map(outlets.map((row) => [row.id, row.name]));
  }, [outlets]);

  const dataSignature = queries.map((query) => query.dataUpdatedAt).join("|");

  const comparisonRows: DashboardOutletComparisonRow[] = useMemo(() => {
    return outletIds.map((outletId, index) => {
      const data = queries[index]?.data;
      return {
        outletId,
        outletName: outletNameById.get(outletId) ?? outletId,
        grossSales: data?.grossSales ?? EMPTY_SALES_SUMMARY.grossSales,
        netSales: data?.netSales ?? EMPTY_SALES_SUMMARY.netSales,
        grossProfit: data?.grossProfit ?? EMPTY_GROSS_PROFIT.grossProfit,
        transactionCount: data?.transactionCount ?? EMPTY_SALES_SUMMARY.transactionCount,
        avgSale: data?.avgSale ?? 0,
        grossMargin: data?.grossMargin ?? EMPTY_GROSS_PROFIT.grossProfitMargin,
        topItems: data?.topItems ?? [],
      };
    });
    // dataSignature tracks query result identity without depending on unstable queries array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature, outletIds, outletNameById]);

  const isLoading = orgLoading || (enabled && queries.some((query) => query.isLoading));
  const isFetching = queries.some((query) => query.isFetching);
  const isError = queries.some((query) => query.isError);
  const error = queries.find((query) => query.error)?.error ?? null;

  return {
    rows: comparisonRows,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: async () => Promise.all(queries.map((query) => query.refetch())),
  };
}

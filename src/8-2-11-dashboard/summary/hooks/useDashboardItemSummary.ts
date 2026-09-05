import { useEffect, useMemo } from "react";
import { useCategorySalesReport } from "@/8-2-10-reports/category-sales/hooks/useCategorySalesReport";
import { useItemSalesReport } from "@/8-2-10-reports/item-sales/hooks/useItemSalesReport";

export type UseDashboardItemSummaryArgs = {
  outletId: string | null;
  fromIso: string;
  toIso: string;
  enabled?: boolean;
};

export function useDashboardItemSummary(args: UseDashboardItemSummaryArgs) {
  const items = useItemSalesReport(args);
  const categories = useCategorySalesReport(args);
  const refetchItems = items.refetch;
  const refetchCategories = categories.refetch;

  useEffect(() => {
    if (args.enabled === false) return;
    const timer = window.setInterval(() => {
      void refetchItems();
      void refetchCategories();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [args.enabled, refetchCategories, refetchItems]);

  const derived = useMemo(() => {
    const top10 = [...items.display.rows]
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 10);
    const categoryQtySlices = categories.display.rows.map((row) => ({
      name: row.categoryName,
      value: row.qtySold,
    }));
    const categorySalesSlices = categories.display.rows.map((row) => ({
      name: row.categoryName,
      value: row.netSales,
    }));
    const leadingCategories = [...categories.display.rows]
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 12);
    const topItemsByCategory = leadingCategories.map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      totalQty: category.qtySold,
      items: items.display.rows
        .filter((item) => (
          category.categoryId
            ? item.categoryId === category.categoryId
            : !item.categoryId
        ))
        .sort((a, b) => b.qtySold - a.qtySold)
        .slice(0, 5),
    }));
    return { top10, categoryQtySlices, categorySalesSlices, topItemsByCategory };
  }, [categories.display.rows, items.display.rows]);

  return {
    ...derived,
    isLoading: items.isLoading || categories.isLoading,
    isFetching: items.isFetching || categories.isFetching,
    isError: items.isError || categories.isError,
    error: items.error ?? categories.error,
  };
}

export type DashboardTopItemsByCategory = ReturnType<
  typeof useDashboardItemSummary
>["topItemsByCategory"][number];

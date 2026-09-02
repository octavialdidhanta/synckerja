import { useState } from "react";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { ItemSalesIncomeTable } from "../components/ItemSalesIncomeTable";
import { ItemSalesQuantityTable } from "../components/ItemSalesQuantityTable";
import { ItemSalesTabs } from "../components/ItemSalesTabs";
import { ItemSalesToolbar } from "../components/ItemSalesToolbar";
import { useItemSalesHourly } from "../hooks/useItemSalesHourly";
import { useItemSalesReport } from "../hooks/useItemSalesReport";
import { exportAmountSoldHourlyXlsx } from "../lib/exportAmountSoldHourlyXlsx";
import { exportItemSalesSummaryXlsx } from "../lib/exportItemSalesSummaryXlsx";
import { exportItemSoldHourlyXlsx } from "../lib/exportItemSoldHourlyXlsx";
import type { ItemSalesTab } from "../lib/itemSalesTypes";

export type ItemSalesExportKind = "summary" | "itemSoldHourly" | "amountSoldHourly";

export function ItemSalesPage() {
  const { t } = useAppTranslation();
  const filters = useReportsSalesPeriodFilters();
  const [activeTab, setActiveTab] = useState<ItemSalesTab>("income");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const report = useItemSalesReport({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    categoryId,
    enabled: !filters.isLoading,
  });

  const hourly = useItemSalesHourly({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    enabled: !filters.isLoading,
  });

  const showContent = useDebouncedReady(!(report.isLoading || filters.isLoading));

  const outletLabel =
    filters.selectedOutletId === POS_OUTLET_FILTER_ALL
      ? t("outlets.filter.all", "All Outlets")
      : filters.selectedOutletName || t("outlets.filter.placeholder", "Outlet");

  const handleExport = (kind: ItemSalesExportKind) => {
    if (kind === "summary") {
      exportItemSalesSummaryXlsx({
        display: report.display,
        tab: activeTab,
        outletLabel,
        fromYmd: filters.dateRange.from,
        toYmd: filters.dateRange.to,
      });
      return;
    }
    if (kind === "itemSoldHourly") {
      exportItemSoldHourlyXlsx({
        hourly: hourly.display,
        summaryRows: report.display.rows,
        outletLabel,
        fromYmd: filters.dateRange.from,
        toYmd: filters.dateRange.to,
      });
      return;
    }
    exportAmountSoldHourlyXlsx({
      hourly: hourly.display,
      summaryRows: report.display.rows,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout showContent={showContent} count={report.display.rows.length}>
      <div className="min-w-0">
        <ItemSalesToolbar
          outletId={filters.selectedOutletId}
          onOutletChange={filters.setSelectedOutletId}
          dateRange={filters.dateRange}
          onDateRangeChange={filters.setDateRange}
          timeFilter={filters.timeFilter}
          onTimeFilterChange={filters.setTimeFilter}
          onApplyFilters={filters.setDateRangeAndTime}
          onExport={handleExport}
          exportDisabled={!showContent || report.isError}
        />
        {report.isError ? (
          <p className="mb-3 text-sm text-destructive">
            {report.error instanceof Error
              ? report.error.message
              : t("reports.itemSales.loadError", "Failed to load item sales report.")}
          </p>
        ) : null}
        <ItemSalesTabs activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === "income" ? (
          <ItemSalesIncomeTable
            display={report.display}
            search={search}
            onSearchChange={setSearch}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
          />
        ) : (
          <ItemSalesQuantityTable
            display={report.display}
            search={search}
            onSearchChange={setSearch}
            categoryId={categoryId}
            onCategoryChange={setCategoryId}
          />
        )}
      </div>
    </ReportsSalesLayout>
  );
}

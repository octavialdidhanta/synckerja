import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { CategorySalesCogsCallout } from "../components/CategorySalesCogsCallout";
import { CategorySalesTable } from "../components/CategorySalesTable";
import { CategorySalesToolbar } from "../components/CategorySalesToolbar";
import { useCategorySalesReport } from "../hooks/useCategorySalesReport";
import { exportCategorySalesXlsx } from "../lib/exportCategorySalesXlsx";

export function CategorySalesPage() {
  const { t } = useAppTranslation();
  const filters = useReportsSalesPeriodFilters();
  const report = useCategorySalesReport({
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

  const outletQuery =
    filters.selectedOutletId && filters.selectedOutletId !== POS_OUTLET_FILTER_ALL
      ? filters.selectedOutletId
      : "all";

  const handleExport = () => {
    exportCategorySalesXlsx({
      display: report.display,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout showContent={showContent} count={report.display.rows.length}>
      <div className="min-w-0">
        <CategorySalesToolbar
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
              : t("reports.categorySales.loadError", "Failed to load category sales report.")}
          </p>
        ) : null}
        <CategorySalesCogsCallout
          visible={showContent && report.display.hasCogsIncomplete}
          outletQuery={outletQuery}
        />
        <CategorySalesTable display={report.display} />
      </div>
    </ReportsSalesLayout>
  );
}

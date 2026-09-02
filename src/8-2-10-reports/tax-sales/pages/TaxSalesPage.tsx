import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { TaxSalesTable } from "../components/TaxSalesTable";
import { TaxSalesToolbar } from "../components/TaxSalesToolbar";
import { useTaxSalesReport } from "../hooks/useTaxSalesReport";
import { exportTaxSalesXlsx } from "../lib/exportTaxSalesXlsx";

export function TaxSalesPage() {
  const { t } = useAppTranslation();
  const filters = useReportsSalesPeriodFilters();
  const report = useTaxSalesReport({
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

  const handleExport = () => {
    exportTaxSalesXlsx({
      display: report.display,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout showContent={showContent} count={report.display.displayRows.length}>
      <div className="min-w-0">
        <TaxSalesToolbar
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
              : t("reports.taxSales.loadError", "Failed to load tax sales report.")}
          </p>
        ) : null}
        <TaxSalesTable
          display={report.display}
          reconciliationDelta={report.reconciliationDelta}
          salesSummaryTaxTotal={report.salesSummaryTaxTotal}
          reportNetTaxCollected={report.reportNetTaxCollected}
        />
      </div>
    </ReportsSalesLayout>
  );
}

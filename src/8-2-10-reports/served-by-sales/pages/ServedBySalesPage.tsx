import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { ServedBySalesTable } from "../components/ServedBySalesTable";
import { ServedBySalesToolbar } from "../components/ServedBySalesToolbar";
import { useServedBySalesReport } from "../hooks/useServedBySalesReport";
import { exportServedBySalesXlsx } from "../lib/exportServedBySalesXlsx";

export function ServedBySalesPage() {
  const { t } = useAppTranslation();
  const filters = useReportsSalesPeriodFilters();
  const report = useServedBySalesReport({
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
    exportServedBySalesXlsx({
      display: report.display,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout showContent={showContent}>
      <div className="min-w-0">
        <ServedBySalesToolbar
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
              : t("reports.servedBySales.loadError", "Failed to load served-by report.")}
          </p>
        ) : null}
        <ServedBySalesTable
          display={report.display}
          reconciliationDeltaGross={report.reconciliationDeltaGross}
          reconciliationDeltaNet={report.reconciliationDeltaNet}
          salesSummaryGrossSales={report.salesSummaryGrossSales}
          salesSummaryNetSales={report.salesSummaryNetSales}
        />
      </div>
    </ReportsSalesLayout>
  );
}

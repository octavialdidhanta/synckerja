import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { GratuitySalesTable } from "../components/GratuitySalesTable";
import { GratuitySalesToolbar } from "../components/GratuitySalesToolbar";
import { useGratuitySalesReport } from "../hooks/useGratuitySalesReport";
import { exportGratuitySalesXlsx } from "../lib/exportGratuitySalesXlsx";

export function GratuitySalesPage() {
  const { t } = useAppTranslation();
  const filters = useReportsSalesPeriodFilters();
  const report = useGratuitySalesReport({
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
    exportGratuitySalesXlsx({
      display: report.display,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout showContent={showContent}>
      <div className="min-w-0">
        <GratuitySalesToolbar
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
              : t("reports.gratuitySales.loadError", "Failed to load gratuity sales report.")}
          </p>
        ) : null}
        <GratuitySalesTable
          display={report.display}
          reconciliationDelta={report.reconciliationDelta}
          salesSummaryGratuityTotal={report.salesSummaryGratuityTotal}
          reportNetGratuityCollected={report.reportNetGratuityCollected}
        />
      </div>
    </ReportsSalesLayout>
  );
}

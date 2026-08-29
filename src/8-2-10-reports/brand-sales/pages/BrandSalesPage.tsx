import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { BrandSalesCogsCallout } from "../components/BrandSalesCogsCallout";
import { BrandSalesTable } from "../components/BrandSalesTable";
import { BrandSalesToolbar } from "../components/BrandSalesToolbar";
import { useBrandSalesByOutlet } from "../hooks/useBrandSalesByOutlet";
import { useBrandSalesReport } from "../hooks/useBrandSalesReport";
import { normalizeBrandSalesOutletRow } from "../lib/computeBrandSalesDisplay";
import {
  exportBrandSalesByItemXlsx,
  exportBrandSalesByOutletXlsx,
} from "../lib/exportBrandSalesXlsx";
import type { BrandSalesExportKind } from "../lib/brandSalesTypes";

export function BrandSalesPage() {
  const { t } = useAppTranslation();
  const filters = useReportsSalesPeriodFilters();
  const report = useBrandSalesReport({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    enabled: !filters.isLoading,
  });
  const outletExport = useBrandSalesByOutlet({
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

  const unbrandedLabel = t("reports.brandSales.unbranded", "Unbranded");

  const handleExport = async (kind: BrandSalesExportKind) => {
    if (kind === "byItem") {
      exportBrandSalesByItemXlsx({
        rows: report.display.items,
        outletLabel,
        fromYmd: filters.dateRange.from,
        toYmd: filters.dateRange.to,
      });
      return;
    }

    const { data } = await outletExport.refetch();
    const rows = (Array.isArray(data) ? data : []).map((row) =>
      normalizeBrandSalesOutletRow(row as Partial<Record<string, unknown>>, unbrandedLabel),
    );

    exportBrandSalesByOutletXlsx({
      rows: rows.map((row) => ({
        brandName: row.brandName,
        outletName: row.outletName,
        qtySold: row.qtySold,
        qtyRefunded: row.qtyRefunded,
        grossSales: row.grossSales,
        discountAmount: row.discountAmount,
        refundAmount: row.refundAmount,
        netSales: row.netSales,
        grossProfit: row.grossProfit,
      })),
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout showContent={showContent}>
      <div className="min-w-0">
        <BrandSalesToolbar
          outletId={filters.selectedOutletId}
          onOutletChange={filters.setSelectedOutletId}
          dateRange={filters.dateRange}
          onDateRangeChange={filters.setDateRange}
          timeFilter={filters.timeFilter}
          onTimeFilterChange={filters.setTimeFilter}
          onApplyFilters={filters.setDateRangeAndTime}
          onExport={(kind) => void handleExport(kind)}
          exportDisabled={!showContent || report.isError}
        />
        {report.isError ? (
          <p className="mb-3 text-sm text-destructive">
            {report.error instanceof Error
              ? report.error.message
              : t("reports.brandSales.loadError", "Failed to load brand sales report.")}
          </p>
        ) : null}
        <BrandSalesCogsCallout
          visible={showContent && report.display.hasCogsIncomplete}
          outletQuery={outletQuery}
        />
        <BrandSalesTable display={report.display} />
      </div>
    </ReportsSalesLayout>
  );
}

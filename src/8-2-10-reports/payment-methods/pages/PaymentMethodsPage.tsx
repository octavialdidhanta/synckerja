import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesLayout } from "../../components/ReportsSalesLayout";
import { useReportsSalesPeriodFilters } from "../../shared/hooks/useReportsSalesPeriodFilters";
import { PaymentMethodsTable } from "../components/PaymentMethodsTable";
import { PaymentMethodsToolbar } from "../components/PaymentMethodsToolbar";
import { usePaymentMethodsReport } from "../hooks/usePaymentMethodsReport";
import { exportPaymentMethodsXlsx } from "../lib/exportPaymentMethodsXlsx";
import { PAYMENT_METHOD_CATEGORY_I18N } from "../lib/paymentMethodCategoryLabels";

export function PaymentMethodsPage() {
  const { t } = useAppTranslation();
  const filters = useReportsSalesPeriodFilters();
  const report = usePaymentMethodsReport({
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

  const categoryLabel = (category: string) => {
    const entry = PAYMENT_METHOD_CATEGORY_I18N[category as keyof typeof PAYMENT_METHOD_CATEGORY_I18N];
    return entry ? t(entry.key, entry.fallback) : category;
  };

  const handleExport = () => {
    exportPaymentMethodsXlsx({
      display: report.display,
      categoryLabel,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout
      showContent={showContent}
      count={report.display.categories.reduce((n, block) => n + block.channels.length, 0)}
    >
      <div className="min-w-0">
        <PaymentMethodsToolbar
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
              : t("reports.paymentMethods.loadError", "Failed to load payment methods report.")}
          </p>
        ) : null}
        <PaymentMethodsTable display={report.display} />
      </div>
    </ReportsSalesLayout>
  );
}

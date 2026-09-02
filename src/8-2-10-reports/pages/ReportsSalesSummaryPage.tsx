import { useLocation } from "react-router-dom";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { GrossProfitPage } from "../gross-profit/pages/GrossProfitPage";
import { BrandSalesPage } from "../brand-sales/pages/BrandSalesPage";
import { CategorySalesPage } from "../category-sales/pages/CategorySalesPage";
import { ModifierSalesPage } from "../modifier-sales/pages/ModifierSalesPage";
import { DiscountSalesPage } from "../discount-sales/pages/DiscountSalesPage";
import { TaxSalesPage } from "../tax-sales/pages/TaxSalesPage";
import { GratuitySalesPage } from "../gratuity-sales/pages/GratuitySalesPage";
import { CollectedBySalesPage } from "../collected-by-sales/pages/CollectedBySalesPage";
import { ServedBySalesPage } from "../served-by-sales/pages/ServedBySalesPage";
import { ItemSalesPage } from "../item-sales/pages/ItemSalesPage";
import { PaymentMethodsPage } from "../payment-methods/pages/PaymentMethodsPage";
import { SalesTypePage } from "../sales-type/pages/SalesTypePage";
import { ReportsSalesLayout } from "../components/ReportsSalesLayout";
import { SalesSummaryTable } from "../sales-summary/components/SalesSummaryTable";
import { SalesSummaryToolbar } from "../sales-summary/components/SalesSummaryToolbar";
import { useSalesSummaryFilters } from "../sales-summary/hooks/useSalesSummaryFilters";
import { useSalesSummaryReport } from "../sales-summary/hooks/useSalesSummaryReport";
import { exportSalesSummaryXlsx } from "../sales-summary/lib/exportSalesSummaryXlsx";
import { reportsSalesNavFromPathname } from "../layout/reportsTabs";

function SalesSummaryPanel() {
  const { t } = useAppTranslation();
  const filters = useSalesSummaryFilters();
  const { metrics, isLoading, isError, error } = useSalesSummaryReport({
    outletId: filters.outletIdForQuery,
    fromIso: filters.timestamps.fromIso,
    toIso: filters.timestamps.toIso,
    enabled: !filters.isLoading,
  });
  const showContent = useDebouncedReady(!(isLoading || filters.isLoading));

  const outletLabel =
    filters.selectedOutletId === POS_OUTLET_FILTER_ALL
      ? t("outlets.filter.all", "All Outlets")
      : filters.selectedOutletName || t("outlets.filter.placeholder", "Outlet");

  const handleExport = () => {
    exportSalesSummaryXlsx({
      metrics,
      outletLabel,
      fromYmd: filters.dateRange.from,
      toYmd: filters.dateRange.to,
    });
  };

  return (
    <ReportsSalesLayout showContent={showContent} count={8}>
      <div className="min-w-0">
        <SalesSummaryToolbar
          outletId={filters.selectedOutletId}
          onOutletChange={filters.setSelectedOutletId}
          dateRange={filters.dateRange}
          onDateRangeChange={filters.setDateRange}
          timeFilter={filters.timeFilter}
          onTimeFilterChange={filters.setTimeFilter}
          onApplyFilters={filters.setDateRangeAndTime}
          onExport={handleExport}
          exportDisabled={!showContent || isError}
        />
        {isError ? (
          <p className="mb-3 text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : t("reports.salesSummary.loadError", "Failed to load sales summary.")}
          </p>
        ) : null}
        <SalesSummaryTable metrics={metrics} />
      </div>
    </ReportsSalesLayout>
  );
}

function GrossProfitPanel() {
  return <GrossProfitPage />;
}

function PaymentMethodsPanel() {
  return <PaymentMethodsPage />;
}

function SalesTypePanel() {
  return <SalesTypePage />;
}

function ItemSalesPanel() {
  return <ItemSalesPage />;
}

function CategorySalesPanel() {
  return <CategorySalesPage />;
}

function BrandSalesPanel() {
  return <BrandSalesPage />;
}

function ModifierSalesPanel() {
  return <ModifierSalesPage />;
}

function DiscountSalesPanel() {
  return <DiscountSalesPage />;
}

function TaxSalesPanel() {
  return <TaxSalesPage />;
}

function GratuitySalesPanel() {
  return <GratuitySalesPage />;
}

function CollectedBySalesPanel() {
  return <CollectedBySalesPage />;
}

function ServedBySalesPanel() {
  return <ServedBySalesPage />;
}

/** All `/operations/reports/sales/*` routes render through this page (Library pattern). */
export default function ReportsSalesSummaryPage() {
  const location = useLocation();
  const navId = reportsSalesNavFromPathname(location.pathname);

  if (navId === "summary") return <SalesSummaryPanel />;
  if (navId === "gross-profit") return <GrossProfitPanel />;
  if (navId === "payment-methods") return <PaymentMethodsPanel />;
  if (navId === "sales-type") return <SalesTypePanel />;
  if (navId === "item-sales") return <ItemSalesPanel />;
  if (navId === "category-sales") return <CategorySalesPanel />;
  if (navId === "brand-sales") return <BrandSalesPanel />;
  if (navId === "modifier-sales") return <ModifierSalesPanel />;
  if (navId === "discounts") return <DiscountSalesPanel />;
  if (navId === "taxes") return <TaxSalesPanel />;
  if (navId === "gratuity") return <GratuitySalesPanel />;
  if (navId === "collected-by") return <CollectedBySalesPanel />;
  if (navId === "served-by") return <ServedBySalesPanel />;
  return <SalesSummaryPanel />;
}

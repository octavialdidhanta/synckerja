import { Download, Home } from "lucide-react";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesDateRangePicker } from "../../shared/components/ReportsSalesDateRangePicker";
import type {
  SalesSummaryDateRange,
  SalesSummaryTimeFilter,
} from "../../sales-summary/lib/salesSummaryTypes";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  dateRange: SalesSummaryDateRange;
  onDateRangeChange: (value: SalesSummaryDateRange) => void;
  timeFilter: SalesSummaryTimeFilter;
  onTimeFilterChange: (value: SalesSummaryTimeFilter) => void;
  onApplyFilters?: (range: SalesSummaryDateRange, time: SalesSummaryTimeFilter) => void;
  onExport: () => void;
  exportDisabled?: boolean;
};

export function ModifierSalesToolbar({
  outletId,
  onOutletChange,
  dateRange,
  onDateRangeChange,
  timeFilter,
  onTimeFilterChange,
  onApplyFilters,
  onExport,
  exportDisabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("reports.tab.sales", "Sales")}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t("reports.modifierSales.title", "Modifier Sales")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              "reports.modifierSales.subtitle",
              "Track add-on and modifier option popularity and revenue for the selected period.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Home className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <OutletFilterSelect
              value={outletId || POS_OUTLET_FILTER_ALL}
              onChange={onOutletChange}
              includeAll
              className="w-[200px] pl-8"
            />
          </div>
          <ReportsSalesDateRangePicker
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            timeFilter={timeFilter}
            onTimeFilterChange={onTimeFilterChange}
            onApplyFilters={onApplyFilters}
          />
        </div>
      </div>
      <Button type="button" size="sm" onClick={onExport} disabled={exportDisabled}>
        <Download className="mr-2 h-4 w-4" />
        {t("reports.actions.export", "Export")}
      </Button>
    </div>
  );
}

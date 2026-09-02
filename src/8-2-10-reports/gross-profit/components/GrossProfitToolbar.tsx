import { Download, Home, SlidersHorizontal } from "lucide-react";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesDateRangePicker } from "../../shared/components/ReportsSalesDateRangePicker";
import { ReportsSalesToolbarShell } from "../../shared/components/ReportsSalesToolbarShell";
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
  onManageCogsAdjustments?: () => void;
};

export function GrossProfitToolbar({
  outletId,
  onOutletChange,
  dateRange,
  onDateRangeChange,
  timeFilter,
  onTimeFilterChange,
  onApplyFilters,
  onExport,
  exportDisabled,
  onManageCogsAdjustments,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <ReportsSalesToolbarShell
      title={t("reports.grossProfit.title", "Gross Profit")}
      description={
        <p className="text-sm text-gray-500">
          {t(
            "reports.grossProfit.subtitle",
            "Net sales minus cost of goods sold for the selected period.",
          )}
        </p>
      }
    >
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
      <div className="flex flex-wrap items-center gap-2">
        {onManageCogsAdjustments ? (
          <Button type="button" size="sm" variant="outline" onClick={onManageCogsAdjustments}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {t("reports.grossProfit.cogsAdjustment.manage", "COGS Adjustments")}
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={onExport} disabled={exportDisabled}>
          <Download className="mr-2 h-4 w-4" />
          {t("reports.actions.export", "Export")}
        </Button>
      </div>
    </ReportsSalesToolbarShell>
  );
}

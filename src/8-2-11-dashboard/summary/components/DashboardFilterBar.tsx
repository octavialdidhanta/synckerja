import {
  OutletFilterSelect,
  POS_OUTLET_FILTER_ALL,
} from "@/8-2-2-outlets";
import { SalesSummaryDateRangePicker } from "@/8-2-10-reports/sales-summary/components/SalesSummaryDateRangePicker";
import type { SalesSummaryDateRange } from "@/8-2-10-reports/sales-summary/lib/salesSummaryTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  outletId: string | null;
  dateRange: SalesSummaryDateRange;
  onOutletIdChange: (outletId: string | null) => void;
  onDateRangeChange: (dateRange: SalesSummaryDateRange) => void;
};

export function DashboardFilterBar({
  outletId,
  dateRange,
  onOutletIdChange,
  onDateRangeChange,
}: Props) {
  const { t } = useAppTranslation();
  const timeFilter = {
    allDay: true,
    startTime: "00:00",
    endTime: "23:59",
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("operationsDashboard.filters.outlet", "Outlet")}
        </p>
        <OutletFilterSelect
          includeAll
          value={outletId ?? POS_OUTLET_FILTER_ALL}
          onChange={(value) => onOutletIdChange(
            value === POS_OUTLET_FILTER_ALL ? null : value,
          )}
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("operationsDashboard.filters.period", "Period")}
        </p>
        <SalesSummaryDateRangePicker
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          timeFilter={timeFilter}
          onTimeFilterChange={() => undefined}
          onApplyFilters={(range) => onDateRangeChange(range)}
          hideTimeFilter
        />
      </div>
    </div>
  );
}

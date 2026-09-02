import { Download, Home } from "lucide-react";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesDateRangePicker } from "../../../shared/components/ReportsSalesDateRangePicker";
import { ReportsSalesToolbarShell } from "../../../shared/components/ReportsSalesToolbarShell";
import type {
  SalesSummaryDateRange,
  SalesSummaryTimeFilter,
} from "../../../sales-summary/lib/salesSummaryTypes";
import type { ShiftStaffOption } from "../lib/shiftTypes";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  dateRange: SalesSummaryDateRange;
  onDateRangeChange: (value: SalesSummaryDateRange) => void;
  timeFilter: SalesSummaryTimeFilter;
  onTimeFilterChange: (value: SalesSummaryTimeFilter) => void;
  onApplyFilters?: (range: SalesSummaryDateRange, time: SalesSummaryTimeFilter) => void;
  staffUserId: string;
  onStaffUserIdChange: (value: string) => void;
  staffFilterAll: string;
  staffOptions: ShiftStaffOption[];
  staffOptionsLoading?: boolean;
  onExport: () => void;
  exportDisabled?: boolean;
};

export function ShiftToolbar({
  outletId,
  onOutletChange,
  dateRange,
  onDateRangeChange,
  timeFilter,
  onTimeFilterChange,
  onApplyFilters,
  staffUserId,
  onStaffUserIdChange,
  staffFilterAll,
  staffOptions,
  staffOptionsLoading,
  onExport,
  exportDisabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <ReportsSalesToolbarShell
      title={t("reports.shift.title", "Shift")}
      description={
        <p className="text-xs text-muted-foreground">
          {t(
            "reports.shift.subtitle",
            "Review cashier shift history and cash reconciliation.",
          )}
        </p>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Home className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <OutletFilterSelect
            value={outletId || POS_OUTLET_FILTER_ALL}
            onChange={onOutletChange}
            includeAll
            className="w-[180px] pl-8"
          />
        </div>
        <ReportsSalesDateRangePicker
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          timeFilter={timeFilter}
          onTimeFilterChange={onTimeFilterChange}
          onApplyFilters={onApplyFilters}
        />
        <Select
          value={staffUserId}
          onValueChange={onStaffUserIdChange}
          disabled={staffOptionsLoading}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue
              placeholder={t("reports.shift.filters.staff", "All staff")}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={staffFilterAll}>
              {t("reports.shift.filters.staffAll", "All staff")}
            </SelectItem>
            {staffOptions.map((opt) => (
              <SelectItem key={opt.userId} value={opt.userId}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="sm"
        className="shrink-0"
        disabled={exportDisabled}
        onClick={onExport}
      >
        <Download className="mr-1.5 h-4 w-4" />
        {t("reports.shift.export", "Export")}
      </Button>
    </ReportsSalesToolbarShell>
  );
}

import { ChevronDown, Download, Home } from "lucide-react";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesDateRangePicker } from "../../shared/components/ReportsSalesDateRangePicker";
import { ReportsSalesToolbarShell } from "../../shared/components/ReportsSalesToolbarShell";
import type {
  SalesSummaryDateRange,
  SalesSummaryTimeFilter,
} from "../../sales-summary/lib/salesSummaryTypes";
import type { BrandSalesExportKind } from "../lib/brandSalesTypes";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  dateRange: SalesSummaryDateRange;
  onDateRangeChange: (value: SalesSummaryDateRange) => void;
  timeFilter: SalesSummaryTimeFilter;
  onTimeFilterChange: (value: SalesSummaryTimeFilter) => void;
  onApplyFilters?: (range: SalesSummaryDateRange, time: SalesSummaryTimeFilter) => void;
  onExport: (kind: BrandSalesExportKind) => void;
  exportDisabled?: boolean;
};

export function BrandSalesToolbar({
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
    <ReportsSalesToolbarShell
      title={t("reports.brandSales.title", "Brand Sales")}
    >
      <div className="flex flex-nowrap items-center gap-2">
        <div className="relative">
          <Home className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <OutletFilterSelect
            value={outletId || POS_OUTLET_FILTER_ALL}
            onChange={onOutletChange}
            includeAll
            className="h-10 w-[200px] pl-8"
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" className="shrink-0" disabled={exportDisabled}>
            <Download className="mr-2 h-4 w-4" />
            {t("reports.actions.export", "Export")}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport("byOutlet")}>
            {t("reports.brandSales.exportByOutlet", "Brand Sales per Outlet")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("byItem")}>
            {t("reports.brandSales.exportByItem", "Brand Sales per Item")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ReportsSalesToolbarShell>
  );
}

import { Download, Home, Search } from "lucide-react";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { ReportsSalesDateRangePicker } from "../../../shared/components/ReportsSalesDateRangePicker";
import { ReportsSalesToolbarShell } from "../../../shared/components/ReportsSalesToolbarShell";
import type {
  SalesSummaryDateRange,
  SalesSummaryTimeFilter,
} from "../../../sales-summary/lib/salesSummaryTypes";
import type { TransactionsTabId } from "../../layout/transactionsTabs";

type Props = {
  tab: TransactionsTabId;
  outletId: string;
  onOutletChange: (id: string) => void;
  dateRange: SalesSummaryDateRange;
  onDateRangeChange: (value: SalesSummaryDateRange) => void;
  timeFilter: SalesSummaryTimeFilter;
  onTimeFilterChange: (value: SalesSummaryTimeFilter) => void;
  onApplyFilters?: (range: SalesSummaryDateRange, time: SalesSummaryTimeFilter) => void;
  receiptQuery: string;
  onReceiptQueryChange: (value: string) => void;
  onExport: () => void;
  exportDisabled?: boolean;
};

export function TransactionsToolbar({
  tab,
  outletId,
  onOutletChange,
  dateRange,
  onDateRangeChange,
  timeFilter,
  onTimeFilterChange,
  onApplyFilters,
  receiptQuery,
  onReceiptQueryChange,
  onExport,
  exportDisabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <ReportsSalesToolbarShell
      title={t("reports.transactions.title", "Transactions")}
      description={
        <p className="text-xs text-muted-foreground">
          {t(
            "reports.transactions.subtitle",
            "Browse and filter completed store transactions.",
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
        {tab === "success" ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={receiptQuery}
              onChange={(e) => onReceiptQueryChange(e.target.value)}
              placeholder={t(
                "reports.transactions.searchReceipt",
                "Search receipt (SC-…)",
              )}
              className="w-[200px] pl-8"
            />
          </div>
        ) : null}
      </div>
      <Button type="button" size="sm" onClick={onExport} disabled={exportDisabled}>
        <Download className="mr-2 h-4 w-4" />
        {t("reports.actions.export", "Export")}
      </Button>
    </ReportsSalesToolbarShell>
  );
}

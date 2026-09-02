import { Download, Home, Search } from "lucide-react";
import { OutletFilterSelect } from "@/8-2-2-outlets/components/OutletFilterSelect";
import { POS_OUTLET_FILTER_ALL } from "@/8-2-2-outlets/lib/assignedOutlets";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
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
import {
  INVOICE_STATUS_FILTER_IDS,
  invoiceStatusLabelKey,
  type InvoiceStatusFilter,
} from "../../layout/invoiceStatus";
import type { InvoiceExportMode } from "../lib/exportInvoicesXlsx";

type Props = {
  outletId: string;
  onOutletChange: (id: string) => void;
  dateRange: SalesSummaryDateRange;
  onDateRangeChange: (value: SalesSummaryDateRange) => void;
  timeFilter: SalesSummaryTimeFilter;
  onTimeFilterChange: (value: SalesSummaryTimeFilter) => void;
  onApplyFilters?: (range: SalesSummaryDateRange, time: SalesSummaryTimeFilter) => void;
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (value: InvoiceStatusFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onExport: (mode: InvoiceExportMode) => void;
  exportDisabled?: boolean;
};

export function InvoicesToolbar({
  outletId,
  onOutletChange,
  dateRange,
  onDateRangeChange,
  timeFilter,
  onTimeFilterChange,
  onApplyFilters,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  onExport,
  exportDisabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <ReportsSalesToolbarShell
      title={t("reports.invoices.title", "Invoices")}
      description={
        <p className="text-xs text-muted-foreground">
          {t(
            "reports.invoices.subtitle",
            "Track invoice status and outstanding balances.",
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
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as InvoiceStatusFilter)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("reports.invoices.status.all", "All statuses")} />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_STATUS_FILTER_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {t(
                  invoiceStatusLabelKey(id),
                  id === "all"
                    ? "All statuses"
                    : id === "partial"
                      ? "Partially Paid"
                      : id.charAt(0).toUpperCase() + id.slice(1),
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t("reports.invoices.search", "Search invoice # or customer")}
            className="w-[220px] pl-8"
          />
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" disabled={exportDisabled}>
            <Download className="mr-2 h-4 w-4" />
            {t("reports.actions.export", "Export")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport("transactions")}>
            {t("reports.invoices.export.transactions", "Transactions")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport("itemDetails")}>
            {t("reports.invoices.export.itemDetails", "Item Details")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ReportsSalesToolbarShell>
  );
}

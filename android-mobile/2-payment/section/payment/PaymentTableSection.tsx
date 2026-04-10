import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PaymentFiltersType } from "@/4-2-payment-process/section/PaymentFilters";
import {
  filterPaymentRequests,
  getUniquePaymentDepartments,
} from "@/4-2-payment-process/utils/paymentUtils";
import { PaymentTable } from "@/4-2-payment-process/section/PaymentTable";
import type { PurchaseRequest } from "@/9-request-form/hooks/usePurchaseRequests";
import { Card, CardContent } from "@/mobile-app/components/ui/card";
import { Button } from "@/mobile-app/components/ui/button";
import { Input } from "@/mobile-app/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/mobile-app/components/ui/drawer";
import { Check, ChevronDown, Filter, FilterX, Search } from "lucide-react";

const SCROLL_HIDE =
  "scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const MOBILE_DEFAULT_FILTERS: PaymentFiltersType = {
  search: "",
  status: "all",
  type: "all",
  department: "all",
  period: "this_month",
};

interface PaymentTableSectionProps {
  requests: PurchaseRequest[];
  isLoading: boolean;
  filters: PaymentFiltersType;
  onFilterChange: (key: keyof PaymentFiltersType, value: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
}

function periodShortLabel(period: string, t: (k: string, f: string) => string) {
  switch (period) {
    case "this_month":
      return t("payments.period.thisMonth", "This Month");
    case "last_month":
      return t("payments.period.lastMonth", "Last Month");
    case "this_year":
      return t("payments.period.thisYear", "This Year");
    case "all":
    default:
      return t("payments.period.allTime", "All time");
  }
}

export function PaymentTableSection({
  requests,
  isLoading,
  filters,
  onFilterChange,
  onClearFilters,
  onRefresh,
}: PaymentTableSectionProps) {
  const { t } = useAppTranslation();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const departmentOptions = useMemo(
    () => getUniquePaymentDepartments(requests.filter((r) => r.status === "approved")),
    [requests],
  );

  const filteredRequests = useMemo(
    () => filterPaymentRequests(requests, filters),
    [requests, filters],
  );

  const isDefaultMobileFilters = (f: PaymentFiltersType) =>
    f.search === MOBILE_DEFAULT_FILTERS.search &&
    f.status === MOBILE_DEFAULT_FILTERS.status &&
    f.type === MOBILE_DEFAULT_FILTERS.type &&
    f.department === MOBILE_DEFAULT_FILTERS.department &&
    f.period === MOBILE_DEFAULT_FILTERS.period;

  const hasActiveFilters = !isDefaultMobileFilters(filters);

  return (
    <div className="min-w-0 w-full">
      <Card className="w-full min-w-0 overflow-hidden border border-border bg-card">
        <CardContent className="flex min-w-0 flex-col p-0">
          <div className="min-w-0 flex-shrink-0 border-b bg-muted/50 px-1.5 py-1.5">
            <div className="flex w-full min-w-0 items-center gap-1">
              <div className="relative min-h-9 min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder={t("payments.searchPlaceholder", "Search payments...")}
                  value={filters.search}
                  onChange={(e) => onFilterChange("search", e.target.value)}
                  className={cn(
                    "h-9 min-w-0 border-border pr-2 pl-8 text-sm",
                    "focus-visible:border-brand-blue focus-visible:ring-brand-blue/30",
                  )}
                />
              </div>
              <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 max-w-[42%] min-w-0 shrink-0 gap-1 px-2 sm:max-w-none">
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{periodShortLabel(filters.period, t)}</span>
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="flex max-h-[85dvh] flex-col">
                  <DrawerHeader className="safe-area-top px-4 pb-2 pt-4 text-left">
                    <DrawerTitle className="text-lg font-semibold">
                      {t("expenses.filtersDrawerTitle", "Filter")}
                    </DrawerTitle>
                  </DrawerHeader>
                  <div
                    className={cn(
                      "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 seamless-scroll",
                      SCROLL_HIDE,
                    )}
                  >
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("payments.filters.period", "Period")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {(
                          [
                            { key: "this_month", label: t("payments.period.thisMonth", "This Month") },
                            { key: "last_month", label: t("payments.period.lastMonth", "Last Month") },
                            { key: "this_year", label: t("payments.period.thisYear", "This Year") },
                            { key: "all", label: t("payments.period.allTime", "All time") },
                          ] as const
                        ).map((row) => (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => onFilterChange("period", row.key)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.period === row.key
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span>{row.label}</span>
                            {filters.period === row.key ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("payments.filters.status", "Status")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {(
                          [
                            { key: "all", label: t("payments.filters.allStatus", "All Status") },
                            { key: "pending", label: t("payments.filters.pending", "Pending") },
                            { key: "processing", label: t("payments.filters.processing", "Processing") },
                            { key: "paid", label: t("payments.filters.paid", "Paid") },
                          ] as const
                        ).map((row) => (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => onFilterChange("status", row.key)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.status === row.key
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span>{row.label}</span>
                            {filters.status === row.key ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("payments.table.type", "Type")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {(
                          [
                            { key: "all", label: t("payments.filters.allTypes", "All Types") },
                            { key: "purchase", label: t("payments.type.purchase", "Purchase") },
                            { key: "reimbursement", label: t("payments.type.reimbursement", "Reimbursement") },
                          ] as const
                        ).map((row) => (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => onFilterChange("type", row.key)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.type === row.key
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span>{row.label}</span>
                            {filters.type === row.key ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("payments.table.department", "Department")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => onFilterChange("department", "all")}
                          className={cn(
                            "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm",
                            filters.department === "all"
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-muted/50",
                          )}
                        >
                          <span>{t("payments.filters.allDepartments", "All Departments")}</span>
                          {filters.department === "all" ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                        {departmentOptions.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => onFilterChange("department", dept)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.department === dept
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span className="truncate">{dept}</span>
                            {filters.department === dept ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-4 pb-3 pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
                      {t("expenses.refreshFilters", "Reset")}
                    </Button>
                    <DrawerClose asChild>
                      <Button size="sm" className="min-w-[100px]">
                        {t("common.done", "Done")}
                      </Button>
                    </DrawerClose>
                  </div>
                </DrawerContent>
              </Drawer>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
                title={t("expenses.refreshFilters", "Reset filters")}
              >
                <FilterX className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 min-w-0 flex-1">
            <PaymentTable
              requests={filteredRequests}
              isLoading={isLoading}
              variant="mobileCard"
              onRefresh={onRefresh}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { MOBILE_DEFAULT_FILTERS };

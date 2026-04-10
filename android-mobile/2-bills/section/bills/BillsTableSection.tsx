import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { Expense } from "@/shared/hooks/finance/useExpenses";
import type { ReminderBillsFiltersType } from "@/4-2-reminder-bills/section/ReminderBillsFilters";
import {
  filterReminderBills,
  getUniqueBillCategories,
  getUniqueBillDepartments,
} from "@/4-2-reminder-bills/utils/reminderBillsUtils";
import { ReminderBillsTable } from "@/4-2-reminder-bills/section/ReminderBillsTable";
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

export const MOBILE_BILLS_DEFAULT_FILTERS: ReminderBillsFiltersType = {
  search: "",
  status: "all",
  category: "all",
  department: "all",
  period: "this_month",
};

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

interface BillsTableSectionProps {
  allBills: Expense[];
  filters: ReminderBillsFiltersType;
  onFilterChange: (key: keyof ReminderBillsFiltersType, value: string) => void;
  onClearFilters: () => void;
  isLoading: boolean;
  onViewDetails: (bill: Expense) => void;
  onEdit: (bill: Expense) => void;
  onDelete: (bill: Expense) => void;
  onPayNow?: (bill: Expense) => void;
  onRefresh: () => void;
}

export function BillsTableSection({
  allBills,
  filters,
  onFilterChange,
  onClearFilters,
  isLoading,
  onViewDetails,
  onEdit,
  onDelete,
  onPayNow,
  onRefresh,
}: BillsTableSectionProps) {
  const { t } = useAppTranslation();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const categoryOptions = useMemo(() => getUniqueBillCategories(allBills), [allBills]);
  const departmentOptions = useMemo(() => getUniqueBillDepartments(allBills), [allBills]);

  const filteredBills = useMemo(() => filterReminderBills(allBills, filters), [allBills, filters]);

  const isDefaultMobileFilters = (f: ReminderBillsFiltersType) =>
    f.search === MOBILE_BILLS_DEFAULT_FILTERS.search &&
    f.status === MOBILE_BILLS_DEFAULT_FILTERS.status &&
    f.category === MOBILE_BILLS_DEFAULT_FILTERS.category &&
    f.department === MOBILE_BILLS_DEFAULT_FILTERS.department &&
    f.period === MOBILE_BILLS_DEFAULT_FILTERS.period;

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
                  placeholder={t("reminderBills.searchPlaceholder", "Search bills...")}
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
                        {t("reminderBills.filters.status", "Status")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {(
                          [
                            { key: "all", label: t("reminderBills.filters.allStatus", "All Status") },
                            { key: "active", label: t("reminderBills.status.active", "Active") },
                            { key: "overdue", label: t("reminderBills.status.overdue", "Overdue") },
                            { key: "paid", label: t("reminderBills.status.paid", "Paid") },
                            { key: "pending", label: t("reminderBills.status.pending", "Pending") },
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
                        {t("reminderBills.table.category", "Category")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => onFilterChange("category", "all")}
                          className={cn(
                            "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm",
                            filters.category === "all"
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-muted/50",
                          )}
                        >
                          <span>{t("reminderBills.filters.allCategories", "All Categories")}</span>
                          {filters.category === "all" ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                        {categoryOptions.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => onFilterChange("category", cat)}
                            className={cn(
                              "flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0",
                              filters.category.toLowerCase() === cat.toLowerCase()
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span className="truncate">{cat}</span>
                            {filters.category.toLowerCase() === cat.toLowerCase() ? (
                              <Check className="h-4 w-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("reminderBills.table.department", "Department")}
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
                          <span>{t("reminderBills.filters.allDepartments", "All Departments")}</span>
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
                              filters.department.toLowerCase() === dept.toLowerCase()
                                ? "bg-primary/10 font-medium text-primary"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <span className="truncate">{dept}</span>
                            {filters.department.toLowerCase() === dept.toLowerCase() ? (
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
            <ReminderBillsTable
              bills={filteredBills}
              isLoading={isLoading}
              variant="mobileCard"
              onRefresh={onRefresh}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onDelete={onDelete}
              onPayNow={onPayNow}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

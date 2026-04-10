import { useMemo, useState } from "react";
import { Search, Filter, FilterX, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Button } from "@/mobile/components/ui/button";
import { Input } from "@/mobile/components/ui/input";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/mobile/components/ui/drawer";
import { useIncomeTransactions } from "@/features/4-1-dashboard/hooks";
import { filterTransactions, getUniqueIncomeCategories, getUniqueIncomeTypes } from "@/features/4-1-transaction/utils/transactionUtils";
import { formatToRupiah } from "@/utils/formatCurrency";
import { MobileIncomeTransactionTable } from "./MobileIncomeTransactionTable";
import type { IncomeTransactionWithRelations } from "@/features/4-1-dashboard/types";
import { MobileAddIncomeTransactionModal } from "../modal/MobileAddIncomeTransactionModal";

type IncomeFilters = {
  search: string;
  status: string;
  type: string;
  category: string;
  period: string;
};

const getDateRangeForPeriod = (period: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();

  let startDate: Date;
  let endDate: Date = new Date(currentYear, currentMonth, currentDate + 1);

  switch (period) {
    case "this_month":
      startDate = new Date(currentYear, currentMonth, 1);
      break;
    case "last_month": {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      startDate = new Date(lastMonthYear, lastMonth, 1);
      endDate = new Date(currentYear, currentMonth, 1);
      break;
    }
    case "last_3_months":
      startDate = new Date(currentYear, currentMonth - 3, 1);
      break;
    case "last_6_months":
      startDate = new Date(currentYear, currentMonth - 6, 1);
      break;
    case "this_year":
      startDate = new Date(currentYear, 0, 1);
      break;
    case "last_year":
      startDate = new Date(currentYear - 1, 0, 1);
      endDate = new Date(currentYear, 0, 1);
      break;
    default:
      startDate = new Date(currentYear, 0, 1);
  }

  return { startDate, endDate };
};

const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function IncomeTransactionTableSection() {
  const { incomeTransactions, isLoading, refetch } = useIncomeTransactions();
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);
  const [filters, setFilters] = useState<IncomeFilters>({
    search: "",
    status: "all",
    type: "all",
    category: "all",
    period: "all",
  });

  const typedTransactions = (incomeTransactions || []) as IncomeTransactionWithRelations[];
  const types = useMemo(() => getUniqueIncomeTypes(typedTransactions), [typedTransactions]);
  const categories = useMemo(() => getUniqueIncomeCategories(typedTransactions), [typedTransactions]);
  const periodFilteredTransactions = useMemo(() => {
    if (!typedTransactions.length) return [];
    if (filters.period === "all") return typedTransactions;
    const { startDate, endDate } = getDateRangeForPeriod(filters.period);
    const startDateStr = formatDateToString(startDate);
    const endDateStr = formatDateToString(endDate);
    return typedTransactions.filter((transaction) => {
      const transactionDate = transaction.transaction_date;
      return transactionDate >= startDateStr && transactionDate < endDateStr;
    });
  }, [typedTransactions, filters.period]);
  const filteredTransactions = useMemo(
    () => filterTransactions(periodFilteredTransactions, filters),
    [periodFilteredTransactions, filters]
  );
  const totalAmount = useMemo(
    () => filteredTransactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0),
    [filteredTransactions]
  );

  const setFilter = (key: keyof IncomeFilters, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({ search: "", status: "all", type: "all", category: "all", period: "all" });

  return (
    <div className="px-2 pt-2 pb-1">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          <div className="px-1.5 py-1.5 border-b bg-muted/50 flex-shrink-0 min-w-0">
            <div className="flex flex-nowrap items-center gap-1 min-w-0">
              <div
                className={cn(
                  "relative flex items-center gap-1 min-w-0 transition-[max-width,flex-basis] duration-300 ease-in-out",
                  searchExpanded ? "flex-[1_1_100%] max-w-full" : "flex-1 min-w-[100px] max-w-[220px]"
                )}
              >
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <Input
                  placeholder="Search transactions..."
                  value={filters.search}
                  onChange={(e) => setFilter("search", e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  onBlur={() => setSearchExpanded(false)}
                  className="pl-8 h-9 w-full min-w-0 pr-8 text-xs placeholder:text-xs"
                />
                {searchExpanded && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 h-7 w-7 flex-shrink-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSearchExpanded(false)}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div
                className={cn(
                  "flex flex-row-reverse flex-nowrap items-center gap-1 min-w-0 shrink overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                  searchExpanded ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[280px] opacity-100"
                )}
              >
                <Button type="button" size="sm" className="h-9 px-3 text-xs shrink-0" onClick={() => setAddIncomeOpen(true)}>
                  + Add Income
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={clearFilters}
                  title="Reset filters"
                >
                  <FilterX className="h-4 w-4" />
                </Button>
                <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                  <DrawerTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 w-auto gap-1 px-2 min-w-[88px] shrink-0">
                      <Filter className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Filter</span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent className="max-h-[85dvh] flex flex-col">
                    <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                      <DrawerTitle className="text-lg font-semibold">Filter Transactions</DrawerTitle>
                    </DrawerHeader>
                    <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                      <FilterGroup
                        title="Period"
                        current={filters.period}
                        options={[
                          { value: "all", label: "All Time" },
                          { value: "this_month", label: "This Month" },
                          { value: "last_month", label: "Last Month" },
                          { value: "last_3_months", label: "Last 3 Months" },
                          { value: "last_6_months", label: "Last 6 Months" },
                          { value: "this_year", label: "This Year" },
                          { value: "last_year", label: "Last Year" },
                        ]}
                        onSelect={(v) => setFilter("period", v)}
                      />
                      <FilterGroup
                        title="Status"
                        current={filters.status}
                        options={[
                          { value: "all", label: "All Status" },
                          { value: "completed", label: "Completed" },
                          { value: "pending", label: "Pending" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                        onSelect={(v) => setFilter("status", v)}
                      />
                      <FilterGroup
                        title="Type"
                        current={filters.type}
                        options={[{ value: "all", label: "All Types" }, ...types.map((v) => ({ value: v, label: v }))]}
                        onSelect={(v) => setFilter("type", v)}
                      />
                      <FilterGroup
                        title="Category"
                        current={filters.category}
                        options={[{ value: "all", label: "All Categories" }, ...categories.map((v) => ({ value: v, label: v }))]}
                        onSelect={(v) => setFilter("category", v)}
                      />
                    </div>
                    <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-between gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                        Reset
                      </Button>
                      <DrawerClose asChild>
                        <Button size="sm" className="min-w-[100px]">
                          Done
                        </Button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <MobileIncomeTransactionTable
              transactions={filteredTransactions as IncomeTransactionWithRelations[]}
              isLoading={isLoading}
              onRefresh={() => refetch()}
            />
          </div>

          <div className="flex-shrink-0 px-4 py-1 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing {filteredTransactions.length} of {typedTransactions.length} transactions
                {filters.type !== "all" ? ` in ${filters.type}` : ""}
              </span>
              <span className="text-xs text-gray-400">Total: {formatToRupiah(totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <MobileAddIncomeTransactionModal
        open={addIncomeOpen}
        onOpenChange={setAddIncomeOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

function FilterGroup({
  title,
  current,
  options,
  onSelect,
}: {
  title: string;
  current: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-col gap-0 rounded-md border bg-card">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
              current === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
            )}
          >
            <span className="truncate">{opt.label}</span>
            {current === opt.value ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { Input } from "@/mobile/components/ui/input";
import { Button } from "@/mobile/components/ui/button";
import { Badge } from "@/mobile/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/features/ui/dialog";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/mobile/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/mobile/components/ui/alert-dialog";
import { Search, Plus, Filter, FilterX, MoreHorizontal, Receipt, Eye, Trash2, ChevronDown, Check, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useExpenses, type Expense } from "@/features/4_2_dashboard/hooks";
import { ExpenseTableFooter } from "@/features/4_2_dashboard/ExpenseTableFooter";
import { supabase } from "@/integrations/supabase/client";
import { CustomDatePicker } from "@/mobile/components/CustomDatePicker";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/mobile/components/ui/drawer";
import type { ExpenseTableItem } from "@/mobile/pages/expenses/hooks/useExpenseTable";
import type { UseExpenseTableReturn } from "@/mobile/pages/expenses/hooks/useExpenseTable";
import { AddNewExpenseModal } from "../modal/AddNewExpenseModal";
import { Skeleton } from "@/mobile/components/ui/skeleton";

function formatCurrency(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

const handleViewInvoice = async (filePath: string | null | undefined) => {
  if (!filePath) {
    toast.error("Invoice file path not found");
    return;
  }
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    window.open(filePath, "_blank");
    return;
  }
  try {
    const { data, error } = await supabase.storage
      .from("purchase-documents")
      .createSignedUrl(filePath, 3600);
    if (error) {
      toast.error("Failed to generate invoice URL.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  } catch {
    toast.error("Failed to open invoice.");
  }
};

export interface ExpenseTableSectionProps {
  /** Filter state and data from parent (DashboardTabContent) so filter affects all sections. */
  expenseTable: UseExpenseTableReturn;
}

/**
 * Mobile Expense table section: same logic as desktop ExpenseDashboard table.
 * Combined expenses + paid PR, filters (date, type, category, dept, withdrawal), search, footer.
 * Placed below Expense Breakdown on /expenses/dashboard.
 */
export function ExpenseTableSection({ expenseTable }: ExpenseTableSectionProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { deleteExpense } = useExpenses();
  const {
    filteredBySearch,
    totalExpenses,
    totalCount,
    isLoading,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    expenseTypeFilter,
    setExpenseTypeFilter,
    departmentFilter,
    setDepartmentFilter,
    categoryFilter,
    setCategoryFilter,
    withdrawalFilter,
    setWithdrawalFilter,
    handleRefreshFilters,
    paidPurchaseRequests,
    expenseTypes,
    allExpenseCategories,
    departments,
    debtsForExpense,
    bankAccounts,
    departmentsLoading,
    debtsLoading,
    bankAccountsLoading,
  } = expenseTable;

  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseTableItem | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const handleViewDetails = (expense: ExpenseTableItem) => {
    setSelectedExpense(expense);
    setIsDetailModalOpen(true);
  };

  const handleDeleteClick = (expenseId: string) => {
    setExpenseToDelete(expenseId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    const success = await deleteExpense(expenseToDelete);
    if (success) {
      setIsDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  const isAddDisabled = false;

  return (
    <div className="px-2 pt-4 pb-6">
      <Card className="w-full min-w-0 border border-border bg-card overflow-hidden">
        <CardContent className="p-0 flex flex-col min-w-0">
          {/* Table Header: Search (expands on focus, hides other filters) + Filter + Reset + Add */}
          <div className="px-1.5 py-1.5 border-b bg-muted/50 flex-shrink-0 min-w-0">
            <div className="flex flex-nowrap items-center gap-1 min-w-0">
              <div
                className={cn(
                  "relative flex items-center gap-1 min-w-0 transition-all duration-300 ease-in-out",
                  searchExpanded ? "flex-[1_1_100%]" : "flex-1 min-w-[100px]"
                )}
              >
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
                <Input
                  placeholder={t("expenses.tableSearchPlaceholder", "Search expenses...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                    aria-label={t("common.close", "Close")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div
                className={cn(
                  "flex flex-row-reverse flex-nowrap items-center gap-1 min-w-0 shrink overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                  searchExpanded ? "max-w-0 opacity-0 pointer-events-none" : "opacity-100"
                )}
              >
              <Button
                size="sm"
                className="h-9 bg-primary flex-shrink-0 gap-1 px-2"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{t("expenses.addExpense", "Add")}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={handleRefreshFilters}
                title={t("expenses.refreshFilters", "Reset filters")}
              >
                <FilterX className="h-4 w-4" />
              </Button>
              <Drawer open={filtersDrawerOpen} onOpenChange={setFiltersDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 shrink gap-1 px-2 min-w-0">
                    <Filter className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate max-w-[70px] sm:max-w-[90px]">
                      {dateFilter === "custom" && customStartDate && customEndDate
                        ? `${format(customStartDate, "MMM d")}-${format(customEndDate, "MMM d")}`
                        : dateFilter === "all-dates"
                        ? t("expenses.dateFilter.allDates", "All Dates")
                        : dateFilter === "this-month"
                        ? t("expenses.dateFilter.thisMonth", "This Month")
                        : dateFilter === "this-year"
                        ? t("expenses.dateFilter.thisYear", "This Year")
                        : dateFilter === "today"
                        ? t("expenses.dateFilter.today", "Today")
                        : dateFilter === "yesterday"
                        ? t("expenses.dateFilter.yesterday", "Yesterday")
                        : dateFilter === "this-week"
                        ? t("expenses.dateFilter.thisWeek", "This Week")
                        : dateFilter === "last-month"
                        ? t("expenses.dateFilter.lastMonth", "Last Month")
                        : dateFilter === "last-year"
                        ? t("expenses.dateFilter.lastYear", "Last Year")
                        : t("expenses.filtersDrawerTitle", "Filter")}
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[85dvh] flex flex-col">
                  <DrawerHeader className="text-left pb-2 safe-area-top px-4 pt-4">
                    <DrawerTitle className="text-lg font-semibold">
                      {t("expenses.filtersDrawerTitle", "Filter")}
                    </DrawerTitle>
                  </DrawerHeader>
                  <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-4 pb-4 seamless-scroll">
                    {/* Date */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t("expenses.filtersDrawerDateLabel", "Date")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        {[
                          { value: "all-dates" as const, label: t("expenses.dateFilter.allDates", "All Dates") },
                          { value: "today" as const, label: t("expenses.dateFilter.today", "Today") },
                          { value: "yesterday" as const, label: t("expenses.dateFilter.yesterday", "Yesterday") },
                          { value: "this-week" as const, label: t("expenses.dateFilter.thisWeek", "This Week") },
                          { value: "this-month" as const, label: t("expenses.dateFilter.thisMonth", "This Month") },
                          { value: "last-month" as const, label: t("expenses.dateFilter.lastMonth", "Last Month") },
                          { value: "3-months-ago" as const, label: t("expenses.dateFilter.3MonthsAgo", "3 Months Ago") },
                          { value: "6-months-ago" as const, label: t("expenses.dateFilter.6MonthsAgo", "6 Months Ago") },
                          { value: "this-year" as const, label: t("expenses.dateFilter.thisYear", "This Year") },
                          { value: "last-year" as const, label: t("expenses.dateFilter.lastYear", "Last Year") },
                          { value: "custom" as const, label: t("expenses.dateFilter.customRange", "Custom Range") },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              if (opt.value === "custom") {
                                setIsCustomDatePickerOpen(true);
                                setFiltersDrawerOpen(false);
                              } else {
                                setDateFilter(opt.value);
                                setCustomStartDate(undefined);
                                setCustomEndDate(undefined);
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              (dateFilter === opt.value) || (opt.value === "custom" && dateFilter === "custom")
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <span>{opt.label}</span>
                            {(dateFilter === opt.value) || (opt.value === "custom" && dateFilter === "custom") ? (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Type */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t("expenses.tableType", "Type")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => setExpenseTypeFilter("all-types")}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                            expenseTypeFilter === "all-types" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                          )}
                        >
                          <span>{t("expenses.expenseTypeFilter.allTypes", "All Types")}</span>
                          {expenseTypeFilter === "all-types" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        {expenseTypes.map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setExpenseTypeFilter(type.name)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              expenseTypeFilter === type.name ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">{type.name}</span>
                            {expenseTypeFilter === type.name ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Category */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t("expenses.tableCategory", "Category")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => setCategoryFilter("all-categories")}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                            categoryFilter === "all-categories" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                          )}
                        >
                          <span>{t("expenses.categoryFilter.allCategories", "All Categories")}</span>
                          {categoryFilter === "all-categories" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        {allExpenseCategories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategoryFilter(cat.id)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              categoryFilter === cat.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">{cat.name}</span>
                            {categoryFilter === cat.id ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Department */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t("expenses.tableDepartment", "Department")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => setDepartmentFilter("all-depts")}
                          disabled={departmentsLoading}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                            departmentFilter === "all-depts" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                          )}
                        >
                          <span>{t("expenses.departmentFilter.allDepts", "All Depts")}</span>
                          {departmentFilter === "all-depts" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        {departments.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setDepartmentFilter(d.name)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              departmentFilter === d.name ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">{d.name}</span>
                            {departmentFilter === d.name ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Withdrawal */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t("expenses.tableWithdrawalFromBalance", "Withdrawal")}
                      </p>
                      <div className="flex flex-col gap-0 rounded-md border bg-card">
                        <button
                          type="button"
                          onClick={() => setWithdrawalFilter("all-withdrawal")}
                          disabled={debtsLoading || bankAccountsLoading}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                            withdrawalFilter === "all-withdrawal" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                          )}
                        >
                          <span>{t("expenses.withdrawalFilter.allWithdrawal", "All")}</span>
                          {withdrawalFilter === "all-withdrawal" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithdrawalFilter("none")}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                            withdrawalFilter === "none" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                          )}
                        >
                          <span>{t("expenses.withdrawalFilter.none", "None")}</span>
                          {withdrawalFilter === "none" ? <Check className="h-4 w-4 text-primary" /> : null}
                        </button>
                        {debtsForExpense.map((debt) => (
                          <button
                            key={debt.id}
                            type="button"
                            onClick={() => setWithdrawalFilter(`debt_${debt.id}`)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border",
                              withdrawalFilter === `debt_${debt.id}` ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">{debt.debt_name}</span>
                            {withdrawalFilter === `debt_${debt.id}` ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
                          </button>
                        ))}
                        {bankAccounts.map((bank) => (
                          <button
                            key={bank.id}
                            type="button"
                            onClick={() => setWithdrawalFilter(`bank_${bank.id}`)}
                            className={cn(
                              "flex items-center justify-between w-full px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0",
                              withdrawalFilter === `bank_${bank.id}` ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="truncate">{bank.name}</span>
                            {withdrawalFilter === `bank_${bank.id}` ? <Check className="h-4 w-4 text-primary flex-shrink-0" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 border-t bg-muted/30 px-4 pt-3 pb-3 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleRefreshFilters();
                        setFiltersDrawerOpen(false);
                      }}
                    >
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
              </div>
            </div>
          </div>

          {/* Table - nested scroll with chaining: table scroll dulu, saat mentok scroll lanjut ke halaman (scroll-chaining rule) */}
          <div className="flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain-xy max-h-[50vh]">
            <table className="w-full min-w-[1400px]">
              <thead className="border-b border-slate-400/50 sticky top-0 z-10 bg-slate-500">
                <tr>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableExpense", "Expense")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableAmount", "Amount")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableWithdrawalFromBalance", "Withdrawal")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tablePaymentDate", "Payment Date")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableTransactionId", "Transaction ID")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableType", "Type")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableCategory", "Category")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableDepartment", "Department")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableDescription", "Description")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableRecurring", "Recurring")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableStatus", "Status")}
                  </th>
                  <th className="text-center py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500" title={t("expenses.receipt", "Receipt")}>
                    {t("expenses.receipt", "Receipt")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableRequestBy", "Request By")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableNextPayment", "Next Payment")}
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-slate-100 whitespace-nowrap text-xs bg-slate-500">
                    {t("expenses.tableActions", "Actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      <td className="py-2 px-2"><Skeleton className="h-4 w-full max-w-[120px]" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-14" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="py-2 px-2 text-center"><Skeleton className="h-5 w-5 rounded-full mx-auto" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-full max-w-[80px]" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-2 px-2"><Skeleton className="h-8 w-8 rounded" /></td>
                    </tr>
                  ))
                ) : filteredBySearch.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-6 text-center text-muted-foreground text-sm">
                      {t("expenses.noExpensesInTable", "No expenses found. Use filters or add an expense.")}
                    </td>
                  </tr>
                ) : (
                  filteredBySearch.map((expense) => {
                    const isPaidPurchaseRequest = paidPurchaseRequests.some((pr) => pr.id === expense.id);
                    const requestTitle =
                      (expense as ExpenseTableItem).request_title ||
                      (isPaidPurchaseRequest
                        ? paidPurchaseRequests.find((pr) => pr.id === expense.id)?.request_title
                        : undefined) ||
                      expense.expense_name ||
                      "-";
                    const requesterName =
                      (expense as ExpenseTableItem).requester_name ||
                      (isPaidPurchaseRequest
                        ? paidPurchaseRequests.find((pr) => pr.id === expense.id)?.requester_name
                        : undefined) ||
                      "-";
                    const withdrawalLabel =
                      expense.withdrawal_from_balance_bank_account?.name ||
                      expense.withdrawal_from_balance_debt?.debt_name ||
                      "-";
                    return (
                      <tr key={expense.id} className="border-b hover:bg-muted/30">
                        <td className="py-2 px-2 max-w-[150px] sm:max-w-[200px] min-w-0">
                          <div className="truncate text-xs" title={requestTitle}>
                            {requestTitle}
                          </div>
                        </td>
                        <td className="py-2 px-2 font-medium whitespace-nowrap text-xs">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="py-2 px-2 max-w-[150px] min-w-0">
                          <div className="truncate text-xs" title={withdrawalLabel}>
                            {withdrawalLabel}
                          </div>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-xs">
                          {format(new Date(expense.create_date), "dd MMM yyyy")}
                        </td>
                        <td className="py-2 px-2 max-w-[120px] sm:max-w-[160px] min-w-0">
                          <div
                            className="truncate text-xs font-mono"
                            title={expense.transaction_reference?.trim() || undefined}
                          >
                            {expense.transaction_reference?.trim() || "—"}
                          </div>
                        </td>
                        <td className="py-2 px-2 max-w-[200px] min-w-0">
                          <div className="truncate text-xs" title={expense.expense_type}>
                            {expense.expense_type}
                          </div>
                        </td>
                        <td className="py-2 px-2 max-w-[200px] min-w-0">
                          <div className="truncate text-xs" title={expense.category}>
                            {expense.category}
                          </div>
                        </td>
                        <td className="py-2 px-2 max-w-[150px] min-w-0">
                          <div className="truncate text-xs" title={expense.department || "N/A"}>
                            {expense.department || "N/A"}
                          </div>
                        </td>
                        <td className="py-2 px-2 max-w-[200px] min-w-0">
                          <div className="truncate text-xs" title={expense.description || "-"}>
                            {expense.description || "-"}
                          </div>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <Badge variant={expense.is_recurring ? "default" : "secondary"} className="text-xs">
                            {expense.is_recurring ? t("expenses.recurring", "Recurring") : t("expenses.oneTime", "One-time")}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <Badge variant="default" className="text-xs">
                            {t("expenses.statusBerhasil", "Berhasil")}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <div className="flex justify-center items-center">
                            {expense.receipt_url ? (
                              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" aria-label={t("expenses.hasReceipt", "Has receipt")} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 max-w-[120px] min-w-0">
                          <div className="truncate text-xs" title={requesterName}>
                            {requesterName}
                          </div>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-xs">
                          {expense.next_payment_date
                            ? format(new Date(expense.next_payment_date), "dd MMM yyyy")
                            : "-"}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {expense.receipt_url && (
                                <DropdownMenuItem
                                  onClick={() => handleViewInvoice(expense.receipt_url)}
                                >
                                  <Receipt className="h-4 w-4 mr-2" />
                                  {isPaidPurchaseRequest
                                    ? t("expenses.viewInvoice", "View Invoice")
                                    : t("expenses.viewReceipt", "View Receipt")}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleViewDetails(expense)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {t("expenses.details", "Details")}
                              </DropdownMenuItem>
                              {!isPaidPurchaseRequest && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteClick(expense.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("expenses.delete", "Delete")}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <ExpenseTableFooter
            totalExpenses={totalExpenses}
            totalCount={totalCount}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Detail Modal - fullscreen on mobile (modal-android-fullscreen rule) */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent
          className={cn(
            isMobile
              ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
              : "w-[95vw] max-w-md max-h-[90vh] grid gap-4 p-6"
          )}
          fullscreenAnimation={isMobile}
        >
          {isMobile ? (
            <>
              <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
                <DialogTitle className="text-lg font-semibold">
                  {t("expenses.expenseDetails", "Expense Details")}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {t("expenses.expenseDetailsDescription", "View detailed information about this expense")}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-4">
                {selectedExpense && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.expenseName", "Expense Name")}</label>
                        <p className="text-sm font-semibold mt-1">{selectedExpense.expense_name}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.amount", "Amount")}</label>
                        <p className="text-sm font-semibold mt-1">{formatCurrency(selectedExpense.amount)}</p>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          {t("expenses.tableTransactionId", "Transaction ID")}
                        </label>
                        <p className="text-sm font-mono mt-1 break-all">
                          {selectedExpense.transaction_reference?.trim() || "—"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.type", "Type")}</label>
                        <p className="text-sm mt-1">{selectedExpense.expense_type}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.category", "Category")}</label>
                        <p className="text-sm mt-1">{selectedExpense.category}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.department", "Department")}</label>
                        <p className="text-sm mt-1">{selectedExpense.department || "N/A"}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.status", "Status")}</label>
                        <div className="mt-1">
                          <Badge variant={selectedExpense.is_recurring ? "default" : "secondary"} className="text-xs">
                            {selectedExpense.is_recurring ? t("expenses.recurring", "Recurring") : t("expenses.oneTime", "One-time")}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.paymentDate", "Payment Date")}</label>
                        <p className="text-sm mt-1">{format(new Date(selectedExpense.create_date), "dd MMM yyyy")}</p>
                      </div>
                      {selectedExpense.next_payment_date && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">{t("expenses.nextPayment", "Next Payment")}</label>
                          <p className="text-sm mt-1">{format(new Date(selectedExpense.next_payment_date), "dd MMM yyyy")}</p>
                        </div>
                      )}
                    </div>
                    {selectedExpense.description && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.description", "Description")}</label>
                        <p className="text-sm mt-1">{selectedExpense.description}</p>
                      </div>
                    )}
                    {selectedExpense.receipt_url && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.receipt", "Receipt")}</label>
                        <div className="mt-2 space-y-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewInvoice(selectedExpense.receipt_url)}>
                            <Receipt className="h-4 w-4 mr-2" />
                            {t("expenses.viewReceipt", "View Receipt")}
                          </Button>
                          {!/\.pdf$/i.test(selectedExpense.receipt_url) ? (
                            <div className="w-full min-h-[calc(100vh-12rem)] rounded-md border bg-muted/30 overflow-hidden">
                              <img
                                src={selectedExpense.receipt_url}
                                alt={t("expenses.receipt", "Receipt")}
                                className="w-full min-h-[calc(100vh-12rem)] object-contain object-left-top"
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t("expenses.receiptPdf", "PDF receipt — use button above to open")}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDetailModalOpen(false)}
                  >
                    {t("common.close", "Close")}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t("expenses.expenseDetails", "Expense Details")}</DialogTitle>
                <DialogDescription>
                  {t("expenses.expenseDetailsDescription", "View detailed information about this expense")}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[60vh]">
                {selectedExpense && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.expenseName", "Expense Name")}</label>
                        <p className="text-sm font-semibold mt-1">{selectedExpense.expense_name}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.amount", "Amount")}</label>
                        <p className="text-sm font-semibold mt-1">{formatCurrency(selectedExpense.amount)}</p>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          {t("expenses.tableTransactionId", "Transaction ID")}
                        </label>
                        <p className="text-sm font-mono mt-1 break-all">
                          {selectedExpense.transaction_reference?.trim() || "—"}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.type", "Type")}</label>
                        <p className="text-sm mt-1">{selectedExpense.expense_type}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.category", "Category")}</label>
                        <p className="text-sm mt-1">{selectedExpense.category}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.department", "Department")}</label>
                        <p className="text-sm mt-1">{selectedExpense.department || "N/A"}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.status", "Status")}</label>
                        <div className="mt-1">
                          <Badge variant={selectedExpense.is_recurring ? "default" : "secondary"} className="text-xs">
                            {selectedExpense.is_recurring ? t("expenses.recurring", "Recurring") : t("expenses.oneTime", "One-time")}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.paymentDate", "Payment Date")}</label>
                        <p className="text-sm mt-1">{format(new Date(selectedExpense.create_date), "dd MMM yyyy")}</p>
                      </div>
                      {selectedExpense.next_payment_date && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">{t("expenses.nextPayment", "Next Payment")}</label>
                          <p className="text-sm mt-1">{format(new Date(selectedExpense.next_payment_date), "dd MMM yyyy")}</p>
                        </div>
                      )}
                    </div>
                    {selectedExpense.description && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.description", "Description")}</label>
                        <p className="text-sm mt-1">{selectedExpense.description}</p>
                      </div>
                    )}
                    {selectedExpense.receipt_url && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{t("expenses.receipt", "Receipt")}</label>
                        <div className="mt-2 space-y-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewInvoice(selectedExpense.receipt_url)}>
                            <Receipt className="h-4 w-4 mr-2" />
                            {t("expenses.viewReceipt", "View Receipt")}
                          </Button>
                          {!/\.pdf$/i.test(selectedExpense.receipt_url) ? (
                            <div className="w-full min-h-[calc(100vh-12rem)] rounded-md border bg-muted/30 overflow-hidden">
                              <img
                                src={selectedExpense.receipt_url}
                                alt={t("expenses.receipt", "Receipt")}
                                className="w-full min-h-[calc(100vh-12rem)] object-contain object-left-top"
                              />
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t("expenses.receiptPdf", "PDF receipt — use button above to open")}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("expenses.deleteExpense", "Delete Expense")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("expenses.deleteConfirm", "Are you sure you want to delete this expense? This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExpenseToDelete(null)}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              {t("expenses.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomDatePicker
        isOpen={isCustomDatePickerOpen}
        onClose={() => setIsCustomDatePickerOpen(false)}
        onDateRangeSelect={(startDate, endDate) => {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
          setDateFilter("custom");
          setIsCustomDatePickerOpen(false);
        }}
        initialStartDate={customStartDate}
        initialEndDate={customEndDate}
      />

      <AddNewExpenseModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} />
    </div>
  );
}

import { useCallback, useMemo, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import type { ExpenseStatsItem } from "@/shared/hooks/finance/useExpenseDashboardStats";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { usePurchaseRequests, type PurchaseRequest } from "@/9-request-form/hooks/usePurchaseRequests";
import { useDepartmentsCrud } from "@/shared/hooks/crudMaster/useDepartmentsCrud";
import { useBankAccounts } from "@/shared/hooks/finance/useBankAccounts";
import { useDebtsForExpense } from "@/shared/hooks/finance/useDebtsForExpense";
import { useExpenseCategories, type ExpenseCategory } from "@/shared/hooks/finance/useExpenseCategories";
import { useExpenses, type Expense } from "@/shared/hooks/finance/useExpenses";
import { useExpenseTypes, type ExpenseType } from "@/shared/hooks/finance/useExpenseTypes";
import { filterExpensesBySearch } from "@/shared/hooks/finance/expenseTableSearch";

export type DateFilterValue =
  | "all-dates"
  | "today"
  | "yesterday"
  | "this-week"
  | "this-month"
  | "last-month"
  | "3-months-ago"
  | "6-months-ago"
  | "this-year"
  | "last-year"
  | "custom";

export type ExpenseTableItem = Expense & {
  request_title?: string;
  requester_name?: string;
};

function getExpenseTypeName(pr: PurchaseRequest, expenseTypes: ExpenseType[]): string {
  const direct = (pr as any)?.expense_types?.name as string | undefined;
  if (direct) return direct;
  if (pr.expense_type_id) {
    const et = expenseTypes.find((e) => e.id === pr.expense_type_id);
    if (et) return et.name;
  }
  return "Uncategorized";
}

function getExpenseCategoryName(pr: PurchaseRequest, allExpenseCategories: ExpenseCategory[]): string {
  const direct = (pr as any)?.expense_categories?.name as string | undefined;
  if (direct) return direct;
  if (pr.expense_category_id) {
    const ec = allExpenseCategories.find((e) => e.id === pr.expense_category_id);
    if (ec) return ec.name;
  }
  return pr.request_type || "Purchase";
}

function calculateNextPaymentDate(lastPaymentDate: string, recurringFrequency: string | null | undefined) {
  if (!recurringFrequency) return undefined;
  const normalized = recurringFrequency.toLowerCase().trim();
  const lastPayment = new Date(lastPaymentDate);
  const nextPayment = new Date(lastPayment);
  switch (normalized) {
    case "daily":
      nextPayment.setDate(nextPayment.getDate() + 1);
      break;
    case "weekly":
      nextPayment.setDate(nextPayment.getDate() + 7);
      break;
    case "biweekly":
    case "bi-weekly":
      nextPayment.setDate(nextPayment.getDate() + 14);
      break;
    case "monthly":
      nextPayment.setMonth(nextPayment.getMonth() + 1);
      break;
    case "quarterly":
      nextPayment.setMonth(nextPayment.getMonth() + 3);
      break;
    case "semiannually":
    case "semi-annually":
      nextPayment.setMonth(nextPayment.getMonth() + 6);
      break;
    case "annually":
      nextPayment.setFullYear(nextPayment.getFullYear() + 1);
      break;
    default:
      return undefined;
  }
  return nextPayment.toISOString().split("T")[0];
}

function matchesWithdrawalFilter(expense: ExpenseTableItem, withdrawalFilter: string): boolean {
  if (!withdrawalFilter || withdrawalFilter === "all-withdrawal") return true;
  const debtIdFromExpense =
    expense.withdrawal_from_balance || (expense as any).withdrawal_from_balance_debt?.id || "";
  const bankIdFromExpense =
    expense.bank_account_id || (expense as any).withdrawal_from_balance_bank_account?.id || "";
  if (withdrawalFilter === "none") return !debtIdFromExpense && !bankIdFromExpense;
  if (withdrawalFilter.startsWith("debt_")) {
    const debtId = withdrawalFilter.replace("debt_", "");
    return debtIdFromExpense === debtId;
  }
  if (withdrawalFilter.startsWith("bank_")) {
    const bankId = withdrawalFilter.replace("bank_", "");
    const legacyBankId =
      (expense as any).withdrawal_from_balance_bank_account?.id ? "" : expense.withdrawal_from_balance || "";
    return bankIdFromExpense === bankId || legacyBankId === bankId;
  }
  return true;
}

export type UseExpenseTableReturn = ReturnType<typeof useExpenseTable>;

/**
 * Shared combined table model for expenses dashboard (desktop + mobile).
 * Keeps the same behavior as current desktop `ExpenseDashboard` for filters + paid PR merge.
 */
export function useExpenseTable() {
  const { organizationId } = useCurrentOrg();
  const { expenses, isLoading: expensesLoading, refetch: refetchExpenses } = useExpenses();
  const { data: purchaseRequests = [], isLoading: prLoading, refetch: refetchPurchaseRequests } = usePurchaseRequests();
  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories: allExpenseCategories } = useExpenseCategories();
  const { data: departments = [], isLoading: departmentsLoading } = useDepartmentsCrud(organizationId);
  const { debts: debtsForExpense, isLoading: debtsLoading } = useDebtsForExpense();
  const { bankAccounts, loading: bankAccountsLoading } = useBankAccounts();

  const [dateFilter, setDateFilter] = useState<DateFilterValue>("this-month");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>("all-types");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all-depts");
  const [categoryFilter, setCategoryFilter] = useState<string>("all-categories");
  const [withdrawalFilter, setWithdrawalFilter] = useState<string>("all-withdrawal");
  const [searchQuery, setSearchQuery] = useState("");

  const isLoading = !organizationId || expensesLoading || prLoading;

  const paidPurchaseRequests = useMemo(
    () =>
      purchaseRequests.filter(
        (req) => req.status === "approved" && (req.paid_at || req.payment_status === "paid"),
      ),
    [purchaseRequests],
  );

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday": {
        const d = subDays(now, 1);
        return { start: startOfDay(d), end: endOfDay(d) };
      }
      case "this-week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month": {
        const d = subMonths(now, 1);
        return { start: startOfMonth(d), end: endOfMonth(d) };
      }
      case "3-months-ago": {
        const d = subMonths(now, 3);
        return { start: startOfMonth(d), end: endOfMonth(d) };
      }
      case "6-months-ago": {
        const d = subMonths(now, 6);
        return { start: startOfMonth(d), end: endOfMonth(d) };
      }
      case "this-year":
        return { start: startOfYear(now), end: endOfYear(now) };
      case "last-year": {
        const d = subYears(now, 1);
        return { start: startOfYear(d), end: endOfYear(d) };
      }
      case "custom":
        if (customStartDate && customEndDate) {
          return { start: startOfDay(customStartDate), end: endOfDay(customEndDate) };
        }
        return null;
      case "all-dates":
      default:
        return null;
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const combinedSorted = useMemo(() => {
    const mappedExpenses: ExpenseTableItem[] = expenses.map((expense) => {
      let nextPaymentDate = expense.next_payment_date;
      if (expense.is_recurring && expense.recurring_frequency) {
        if (!nextPaymentDate) {
          nextPaymentDate = calculateNextPaymentDate(expense.create_date, expense.recurring_frequency);
        } else {
          const nextPayment = new Date(nextPaymentDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (nextPayment < today) {
            nextPaymentDate = calculateNextPaymentDate(nextPaymentDate, expense.recurring_frequency);
          }
        }
      }
      const linkedRequest = expense.purchase_request_id
        ? paidPurchaseRequests.find((pr) => pr.id === expense.purchase_request_id)
        : undefined;
      return {
        ...expense,
        request_title: expense.expense_name,
        requester_name: linkedRequest?.requester_name ?? undefined,
        next_payment_date: nextPaymentDate || expense.next_payment_date,
      };
    });

    const combined: ExpenseTableItem[] = [...mappedExpenses];
    paidPurchaseRequests.forEach((pr) => {
      if (expenses.some((e) => e.purchase_request_id === pr.id)) return;
      const lastPaymentDate = pr.paid_at || pr.approved_at || pr.created_at;
      const nextPaymentDate =
        pr.is_recurring && pr.recurring_frequency
          ? calculateNextPaymentDate(lastPaymentDate, pr.recurring_frequency)
          : undefined;

      combined.push({
        id: pr.id,
        organization_id: pr.organization_id,
        expense_name: pr.request_title,
        amount: pr.amount_idr,
        expense_type: getExpenseTypeName(pr, expenseTypes),
        expense_type_id: pr.expense_type_id || undefined,
        category: getExpenseCategoryName(pr, allExpenseCategories),
        expense_category_id: pr.expense_category_id || undefined,
        department: pr.department_name || undefined,
        create_date: lastPaymentDate,
        is_recurring: pr.is_recurring || false,
        recurring_frequency: pr.recurring_frequency || undefined,
        first_payment_date: undefined,
        next_payment_date: nextPaymentDate,
        description: pr.description,
        receipt_url: pr.invoice_file_path || undefined,
        status: "active",
        created_by: pr.created_by,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        request_title: pr.request_title,
        requester_name: pr.requester_name,
      } as ExpenseTableItem);
    });

    return [...combined].sort((a, b) => new Date(b.create_date).getTime() - new Date(a.create_date).getTime());
  }, [expenses, paidPurchaseRequests, expenseTypes, allExpenseCategories]);

  const allExpenses = useMemo(() => {
    let filtered = combinedSorted;
    if (dateRange) {
      filtered = filtered.filter((expense) => {
        const t = new Date(expense.create_date).getTime();
        return t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
      });
    }
    if (expenseTypeFilter && expenseTypeFilter !== "all-types") {
      filtered = filtered.filter((expense) => expense.expense_type === expenseTypeFilter);
    }
    if (departmentFilter && departmentFilter !== "all-depts") {
      filtered = filtered.filter((expense) => expense.department === departmentFilter);
    }
    if (categoryFilter && categoryFilter !== "all-categories") {
      filtered = filtered.filter((expense) => expense.expense_category_id === categoryFilter);
    }
    if (withdrawalFilter) {
      filtered = filtered.filter((expense) => matchesWithdrawalFilter(expense, withdrawalFilter));
    }
    return filtered;
  }, [combinedSorted, dateRange, expenseTypeFilter, departmentFilter, categoryFilter, withdrawalFilter]);

  /** Same filters as allExpenses but without category (Expense Breakdown "Expense Category" tab). */
  const allExpensesForCategoryBreakdown = useMemo(() => {
    let filtered = combinedSorted;
    if (dateRange) {
      filtered = filtered.filter((expense) => {
        const t = new Date(expense.create_date).getTime();
        return t >= dateRange.start.getTime() && t <= dateRange.end.getTime();
      });
    }
    if (expenseTypeFilter && expenseTypeFilter !== "all-types") {
      filtered = filtered.filter((expense) => expense.expense_type === expenseTypeFilter);
    }
    if (departmentFilter && departmentFilter !== "all-depts") {
      filtered = filtered.filter((expense) => expense.department === departmentFilter);
    }
    if (withdrawalFilter) {
      filtered = filtered.filter((expense) => matchesWithdrawalFilter(expense, withdrawalFilter));
    }
    return filtered;
  }, [combinedSorted, dateRange, expenseTypeFilter, departmentFilter, withdrawalFilter]);

  const filteredBySearch = useMemo(
    () => filterExpensesBySearch(allExpenses, searchQuery),
    [allExpenses, searchQuery],
  );

  const filteredBySearchForCategoryBreakdown = useMemo(
    () => filterExpensesBySearch(allExpensesForCategoryBreakdown, searchQuery),
    [allExpensesForCategoryBreakdown, searchQuery],
  );

  const totalExpenses = useMemo(
    () => allExpenses.reduce((sum, expense) => sum + (expense.amount ?? 0), 0),
    [allExpenses],
  );
  const totalCount = allExpenses.length;

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const startT = start.getTime();
    const endT = end.getTime();
    return allExpenses
      .filter((e) => {
        const t = new Date(e.create_date).getTime();
        return t >= startT && t <= endT;
      })
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
  }, [allExpenses]);

  const toStatsItem = (e: ExpenseTableItem): ExpenseStatsItem => ({
    create_date: e.create_date,
    amount: e.amount,
    expense_name: e.expense_name,
    created_at: e.created_at,
  });

  const highestExpense = useMemo((): ExpenseStatsItem | null => {
    if (allExpenses.length === 0) return null;
    const maxAmount = Math.max(...allExpenses.map((e) => e.amount ?? 0));
    const found = allExpenses.find((e) => (e.amount ?? 0) === maxAmount);
    return found ? toStatsItem(found) : null;
  }, [allExpenses]);

  const latestExpense = useMemo((): ExpenseStatsItem | null => {
    if (allExpenses.length === 0) return null;
    return toStatsItem(allExpenses[0]);
  }, [allExpenses]);

  const refreshData = useCallback(async () => {
    await Promise.all([refetchExpenses(), refetchPurchaseRequests()]);
  }, [refetchExpenses, refetchPurchaseRequests]);

  const handleRefreshFilters = useCallback(() => {
    setDateFilter("this-month");
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setExpenseTypeFilter("all-types");
    setDepartmentFilter("all-depts");
    setCategoryFilter("all-categories");
    setWithdrawalFilter("all-withdrawal");
    setSearchQuery("");
  }, []);

  return {
    isLoading,
    refreshData,
    allExpenses,
    allExpensesForCategoryBreakdown,
    filteredBySearch,
    filteredBySearchForCategoryBreakdown,
    totalExpenses,
    totalCount,
    currentMonthTotal,
    highestExpense,
    latestExpense,
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
    searchQuery,
    setSearchQuery,
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
  };
}


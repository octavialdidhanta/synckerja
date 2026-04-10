import { useState, useMemo, useCallback } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { useExpenses, type Expense } from "@/features/4_2_dashboard/hooks";
import { usePurchaseRequests, type PurchaseRequest } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { useExpenseTypes } from "@/features/4_2_dashboard/hooks/useExpenseTypes";
import { useExpenseCategories } from "@/features/4_2_dashboard/hooks/useExpenseCategories";
import { useDepartmentsCrud } from "@/features/2-1-employees/MyInfo/Employment/hooks/crudMaster/useDepartmentsCrud";
import { useCurrentOrg } from "@/features/share/hooks/useCurrentOrg";
import { useDebtsForExpense } from "@/features/4_2_dashboard/hooks/useDebtsForExpense";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";
import type { ExpenseStatsItem } from "@/mobile/pages/expenses/hooks/useExpenseDashboardStats";

import type { ExpenseType } from "@/features/4_2_dashboard/hooks/useExpenseTypes";
import type { ExpenseCategory } from "@/features/4_2_dashboard/hooks/useExpenseCategories";

export type ExpenseTableItem = Expense & { request_title?: string; requester_name?: string };

function getExpenseTypeName(pr: PurchaseRequest, expenseTypes: ExpenseType[]): string {
  if (pr.expense_types?.name) return pr.expense_types.name;
  if (pr.expense_type_id && expenseTypes.length > 0) {
    const et = expenseTypes.find((e) => e.id === pr.expense_type_id);
    if (et) return et.name;
  }
  return "Uncategorized";
}

function getExpenseCategoryName(pr: PurchaseRequest, allExpenseCategories: ExpenseCategory[]): string {
  if (pr.expense_categories?.name) return pr.expense_categories.name;
  if (pr.expense_category_id && allExpenseCategories.length > 0) {
    const ec = allExpenseCategories.find((e) => e.id === pr.expense_category_id);
    if (ec) return ec.name;
  }
  return pr.request_type || "Purchase";
}

function calculateNextPaymentDate(
  lastPaymentDate: string,
  recurringFrequency: string | undefined | null
): string | undefined {
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

/**
 * Same logic as desktop ExpenseDashboard table: combined expenses + paid PR,
 * sorted by date, filtered by date range, expense type, department, category, withdrawal.
 * Search is applied in the UI over allExpenses.
 */
export function useExpenseTable() {
  const { organizationId } = useCurrentOrg();
  const { expenses, isLoading: expensesLoading, refetch: refetchExpenses } = useExpenses();
  const { data: purchaseRequests = [], isLoading: prLoading, refetch: refetchPurchaseRequests } = usePurchaseRequests();
  const isLoading = !organizationId || expensesLoading || prLoading;
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

  const paidPurchaseRequests = useMemo(
    () =>
      purchaseRequests.filter(
        (req) =>
          req.status === "approved" && (req.paid_at || req.payment_status === "paid")
      ),
    [purchaseRequests]
  );

  const getDateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday": {
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      }
      case "this-week":
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case "this-month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month": {
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      }
      case "3-months-ago": {
        const threeMonthsAgo = subMonths(now, 3);
        return { start: startOfMonth(threeMonthsAgo), end: endOfMonth(threeMonthsAgo) };
      }
      case "6-months-ago": {
        const sixMonthsAgo = subMonths(now, 6);
        return { start: startOfMonth(sixMonthsAgo), end: endOfMonth(sixMonthsAgo) };
      }
      case "this-year":
        return { start: startOfYear(now), end: endOfYear(now) };
      case "last-year": {
        const lastYear = subYears(now, 1);
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
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
      const expenseTypeName = getExpenseTypeName(pr, expenseTypes);
      const expenseCategoryName = getExpenseCategoryName(pr, allExpenseCategories);
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
        expense_type: expenseTypeName,
        expense_type_id: pr.expense_type_id || undefined,
        category: expenseCategoryName,
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
    return [...combined].sort((a, b) => {
      const dateA = new Date(a.create_date).getTime();
      const dateB = new Date(b.create_date).getTime();
      return dateB - dateA;
    });
  }, [
    expenses,
    paidPurchaseRequests,
    expenseTypes,
    allExpenseCategories,
  ]);

  const allExpenses = useMemo(() => {
    let filtered = combinedSorted;

    if (getDateRange) {
      filtered = filtered.filter((expense) => {
        const expenseDate = new Date(expense.create_date);
        const t = expenseDate.getTime();
        return t >= getDateRange!.start.getTime() && t <= getDateRange!.end.getTime();
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
    if (withdrawalFilter && withdrawalFilter !== "all-withdrawal") {
      if (withdrawalFilter === "none") {
        filtered = filtered.filter((expense) => !expense.withdrawal_from_balance && !expense.bank_account_id);
      } else if (withdrawalFilter.startsWith("debt_")) {
        const debtId = withdrawalFilter.replace("debt_", "");
        filtered = filtered.filter((expense) => expense.withdrawal_from_balance === debtId);
      } else if (withdrawalFilter.startsWith("bank_")) {
        const bankId = withdrawalFilter.replace("bank_", "");
        filtered = filtered.filter((expense) => expense.bank_account_id === bankId);
      }
    }
    if (categoryFilter && categoryFilter !== "all-categories") {
      filtered = filtered.filter((expense) => expense.expense_category_id === categoryFilter);
    }
    return filtered;
  }, [
    expenses,
    paidPurchaseRequests,
    expenseTypes,
    allExpenseCategories,
    getDateRange,
    expenseTypeFilter,
    departmentFilter,
    categoryFilter,
    withdrawalFilter,
  ]);

  /** Same filters as allExpenses but WITHOUT category (for Expense Breakdown Category tab, same as desktop). */
  const allExpensesForCategoryBreakdown = useMemo(() => {
    const sorted = combinedSorted;
    let filtered = sorted;
    if (getDateRange) {
      filtered = filtered.filter((expense) => {
        const expenseDate = new Date(expense.create_date);
        const t = expenseDate.getTime();
        return t >= getDateRange!.start.getTime() && t <= getDateRange!.end.getTime();
      });
    }
    if (expenseTypeFilter && expenseTypeFilter !== "all-types") {
      filtered = filtered.filter((expense) => expense.expense_type === expenseTypeFilter);
    }
    if (departmentFilter && departmentFilter !== "all-depts") {
      filtered = filtered.filter((expense) => expense.department === departmentFilter);
    }
    if (withdrawalFilter && withdrawalFilter !== "all-withdrawal") {
      if (withdrawalFilter === "none") {
        filtered = filtered.filter((expense) => !expense.withdrawal_from_balance && !expense.bank_account_id);
      } else if (withdrawalFilter.startsWith("debt_")) {
        const debtId = withdrawalFilter.replace("debt_", "");
        filtered = filtered.filter((expense) => expense.withdrawal_from_balance === debtId);
      } else if (withdrawalFilter.startsWith("bank_")) {
        const bankId = withdrawalFilter.replace("bank_", "");
        filtered = filtered.filter((expense) => expense.bank_account_id === bankId);
      }
    }
    return filtered;
  }, [
    getDateRange,
    expenseTypeFilter,
    departmentFilter,
    withdrawalFilter,
    combinedSorted,
  ]);

  const totalExpenses = useMemo(
    () => allExpenses.reduce((sum, e) => sum + e.amount, 0),
    [allExpenses]
  );

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
      .reduce((sum, e) => sum + e.amount, 0);
  }, [allExpenses]);

  const toStatsItem = (e: ExpenseTableItem): ExpenseStatsItem => ({
    create_date: e.create_date,
    amount: e.amount,
    expense_name: e.expense_name,
    created_at: e.created_at,
  });

  const highestExpense = useMemo((): ExpenseStatsItem | null => {
    if (allExpenses.length === 0) return null;
    const maxAmount = Math.max(...allExpenses.map((e) => e.amount));
    const found = allExpenses.find((e) => e.amount === maxAmount);
    return found ? toStatsItem(found) : null;
  }, [allExpenses]);

  const latestExpense = useMemo((): ExpenseStatsItem | null => {
    if (allExpenses.length === 0) return null;
    return toStatsItem(allExpenses[0]);
  }, [allExpenses]);

  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return allExpenses;
    const q = searchQuery.toLowerCase().trim();
    return allExpenses.filter(
      (expense) =>
        expense.expense_name.toLowerCase().includes(q) ||
        (expense.category || "").toLowerCase().includes(q) ||
        (expense.transaction_reference || "").toLowerCase().includes(q)
    );
  }, [allExpenses, searchQuery]);

  const handleRefreshFilters = () => {
    setDateFilter("this-month");
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setExpenseTypeFilter("all-types");
    setDepartmentFilter("all-depts");
    setCategoryFilter("all-categories");
    setWithdrawalFilter("all-withdrawal");
    setSearchQuery("");
  };

  const refreshData = useCallback(async () => {
    await Promise.all([refetchExpenses(), refetchPurchaseRequests()]);
  }, [refetchExpenses, refetchPurchaseRequests]);

  return {
    allExpenses,
    allExpensesForCategoryBreakdown,
    filteredBySearch,
    totalExpenses,
    totalCount: allExpenses.length,
    currentMonthTotal,
    highestExpense,
    latestExpense,
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
    refreshData,
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

export type UseExpenseTableReturn = ReturnType<typeof useExpenseTable>;

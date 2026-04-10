import { useMemo } from "react";
import { startOfYear, endOfDay } from "date-fns";
import { useExpenses } from "@/features/4_2_dashboard/hooks";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";
import { useExpenseTypes } from "@/features/4_2_dashboard/hooks/useExpenseTypes";
import { useExpenseCategories } from "@/features/4_2_dashboard/hooks/useExpenseCategories";
import type { PurchaseRequest } from "@/features/9_request-form/hooks/usePurchaseRequests";
import type { ExpenseType } from "@/features/4_2_dashboard/hooks/useExpenseTypes";
import type { ExpenseCategory } from "@/features/4_2_dashboard/hooks/useExpenseCategories";

export interface ExpenseBreakdownItem {
  amount: number;
  expense_type: string;
  category: string;
}

function getExpenseTypeName(
  pr: PurchaseRequest,
  expenseTypes: ExpenseType[]
): string {
  if (pr.expense_types?.name) return pr.expense_types.name;
  if (pr.expense_type_id && expenseTypes.length > 0) {
    const et = expenseTypes.find((e) => e.id === pr.expense_type_id);
    if (et) return et.name;
  }
  return "Uncategorized";
}

function getExpenseCategoryName(
  pr: PurchaseRequest,
  allExpenseCategories: ExpenseCategory[]
): string {
  if (pr.expense_categories?.name) return pr.expense_categories.name;
  if (pr.expense_category_id && allExpenseCategories.length > 0) {
    const ec = allExpenseCategories.find((e) => e.id === pr.expense_category_id);
    if (ec) return ec.name;
  }
  return pr.request_type || "Purchase";
}

/**
 * Expense Breakdown: combined expenses + paid PR with expense_type and category.
 * Filtered by YTD (1 Jan - today) so the total matches "Total Expenses YTD" and
 * the breakdown is clearly "YTD breakdown". No double count: PR that already
 * have an expense row are excluded.
 */
export function useExpenseBreakdown() {
  const { expenses, isLoading: expensesLoading } = useExpenses();
  const { data: purchaseRequests = [], isLoading: prLoading } = usePurchaseRequests();
  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories: allExpenseCategories } = useExpenseCategories();

  const paidPurchaseRequests = useMemo(
    () =>
      purchaseRequests.filter(
        (req) =>
          req.status === "approved" &&
          (req.paid_at || req.payment_status === "paid")
      ),
    [purchaseRequests]
  );

  const ytdStartT = useMemo(
    () => startOfYear(new Date()).getTime(),
    []
  );
  const ytdEndT = useMemo(
    () => endOfDay(new Date()).getTime(),
    []
  );

  const allExpenses = useMemo(() => {
    const fromExpenses: ExpenseBreakdownItem[] = expenses
      .filter((e) => {
        const t = new Date(e.create_date).getTime();
        return t >= ytdStartT && t <= ytdEndT;
      })
      .map((e) => ({
        amount: e.amount,
        expense_type: e.expense_type || "Uncategorized",
        category: e.category || "Uncategorized",
      }));
    const fromPr: ExpenseBreakdownItem[] = paidPurchaseRequests
      .filter((pr) => !expenses.some((e) => e.purchase_request_id === pr.id))
      .filter((pr) => {
        const lastPayment = pr.paid_at || pr.approved_at || pr.created_at;
        const t = new Date(lastPayment).getTime();
        return t >= ytdStartT && t <= ytdEndT;
      })
      .map((pr) => ({
        amount: pr.amount_idr,
        expense_type: getExpenseTypeName(pr, expenseTypes),
        category: getExpenseCategoryName(pr, allExpenseCategories),
      }));
    return [...fromExpenses, ...fromPr];
  }, [expenses, paidPurchaseRequests, expenseTypes, allExpenseCategories, ytdStartT, ytdEndT]);

  const allExpensesForCategoryBreakdown = useMemo(() => allExpenses, [allExpenses]);

  const totalExpenses = useMemo(
    () => allExpenses.reduce((sum, e) => sum + e.amount, 0),
    [allExpenses]
  );

  return {
    allExpenses,
    allExpensesForCategoryBreakdown,
    totalExpenses,
    isLoading: expensesLoading || prLoading,
  };
}

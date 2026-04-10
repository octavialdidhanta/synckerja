import { useMemo } from "react";
import { endOfDay, startOfYear } from "date-fns";
import { useExpenses } from "@/shared/hooks/finance/useExpenses";
import { usePurchaseRequests, type PurchaseRequest } from "@/9-request-form/hooks/usePurchaseRequests";
import { useExpenseTypes, type ExpenseType } from "@/shared/hooks/finance/useExpenseTypes";
import { useExpenseCategories, type ExpenseCategory } from "@/shared/hooks/finance/useExpenseCategories";

export interface ExpenseBreakdownItem {
  amount: number;
  expense_type: string;
  category: string;
  create_date?: string;
}

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

/** YTD breakdown when parent does not pass filtered props into ExpenseBreakdownSection. */
export function useExpenseBreakdown() {
  const { expenses, isLoading: expensesLoading } = useExpenses();
  const { data: purchaseRequests = [], isLoading: prLoading } = usePurchaseRequests();
  const { expenseTypes } = useExpenseTypes();
  const { expenseCategories: allExpenseCategories } = useExpenseCategories();

  const paidPurchaseRequests = useMemo(
    () =>
      purchaseRequests.filter(
        (req) => req.status === "approved" && (req.paid_at || req.payment_status === "paid"),
      ),
    [purchaseRequests],
  );

  const ytdStartT = useMemo(() => startOfYear(new Date()).getTime(), []);
  const ytdEndT = useMemo(() => endOfDay(new Date()).getTime(), []);

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
        create_date: e.create_date,
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
        create_date: pr.paid_at || pr.approved_at || pr.created_at,
      }));
    return [...fromExpenses, ...fromPr];
  }, [expenses, paidPurchaseRequests, expenseTypes, allExpenseCategories, ytdStartT, ytdEndT]);

  const allExpensesForCategoryBreakdown = useMemo(() => allExpenses, [allExpenses]);

  const totalExpenses = useMemo(
    () => allExpenses.reduce((sum, e) => sum + e.amount, 0),
    [allExpenses],
  );

  return {
    allExpenses,
    allExpensesForCategoryBreakdown,
    totalExpenses,
    isLoading: expensesLoading || prLoading,
  };
}

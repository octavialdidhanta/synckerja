import { useMemo } from "react";
import { startOfYear, endOfDay } from "date-fns";
import { useCurrentOrg } from "@/features/share/hooks/useCurrentOrg";
import { useExpenses } from "@/features/4_2_dashboard/hooks";
import { usePurchaseRequests } from "@/features/9_request-form/hooks/usePurchaseRequests";

export interface ExpenseStatsItem {
  create_date: string;
  amount: number;
  expense_name: string;
  created_at: string;
}

/**
 * Same logic as desktop ExpenseDashboard: combined expenses + paid purchase requests,
 * sorted by date (newest first). No user filters - all data for stats.
 */
export function useExpenseDashboardStats() {
  const { organizationId } = useCurrentOrg();
  const { expenses, isLoading: expensesLoading } = useExpenses();
  const { data: purchaseRequests = [], isLoading: prLoading } = usePurchaseRequests();

  const paidPurchaseRequests = useMemo(
    () =>
      purchaseRequests.filter(
        (req) =>
          req.status === "approved" &&
          (req.paid_at || req.payment_status === "paid")
      ),
    [purchaseRequests]
  );

  const allExpenses = useMemo(() => {
    const fromExpenses: ExpenseStatsItem[] = expenses.map((e) => ({
      create_date: e.create_date,
      amount: e.amount,
      expense_name: e.expense_name,
      created_at: e.created_at,
    }));
    const fromPr: ExpenseStatsItem[] = paidPurchaseRequests
      .filter((pr) => !expenses.some((e) => e.purchase_request_id === pr.id))
      .map((pr) => ({
        create_date: pr.paid_at || pr.approved_at || pr.created_at,
        amount: pr.amount_idr,
        expense_name: pr.request_title,
        created_at: pr.created_at,
      }));
    const combined = [...fromExpenses, ...fromPr].sort((a, b) => {
      const tA = new Date(a.create_date).getTime();
      const tB = new Date(b.create_date).getTime();
      return tB - tA;
    });
    return combined;
  }, [expenses, paidPurchaseRequests]);

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    return allExpenses
      .filter((e) => {
        const d = new Date(e.create_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [allExpenses]);

  const { totalExpensesYTD, ytdTransactionCount } = useMemo(() => {
    const now = new Date();
    const ytdStart = startOfYear(now);
    const ytdEnd = endOfDay(now);
    const ytdStartT = ytdStart.getTime();
    const ytdEndT = ytdEnd.getTime();
    let total = 0;
    let count = 0;
    expenses.forEach((exp) => {
      const t = new Date(exp.create_date).getTime();
      if (t >= ytdStartT && t <= ytdEndT) {
        total += exp.amount;
        count += 1;
      }
    });
    paidPurchaseRequests.forEach((pr) => {
      if (expenses.some((e) => e.purchase_request_id === pr.id)) return;
      const lastPayment = pr.paid_at || pr.approved_at || pr.created_at;
      const t = new Date(lastPayment).getTime();
      if (t >= ytdStartT && t <= ytdEndT) {
        total += pr.amount_idr;
        count += 1;
      }
    });
    return { totalExpensesYTD: total, ytdTransactionCount: count };
  }, [expenses, paidPurchaseRequests]);

  const highestExpense = useMemo(() => {
    if (allExpenses.length === 0) return null;
    const maxAmount = Math.max(...allExpenses.map((e) => e.amount));
    return allExpenses.find((e) => e.amount === maxAmount) ?? null;
  }, [allExpenses]);

  const latestExpense = useMemo(
    () => (allExpenses.length > 0 ? allExpenses[0] : null),
    [allExpenses]
  );

  const isLoading = !organizationId || expensesLoading || prLoading;

  return {
    allExpenses,
    currentMonthTotal,
    totalExpensesYTD,
    ytdTransactionCount,
    highestExpense,
    latestExpense,
    isLoading,
  };
}

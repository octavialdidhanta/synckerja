import { useMemo } from "react";

export interface MonthlyDataItem {
  month: string;
  amount: number;
}

/**
 * Same logic as desktop ExpenseDashboard: from filtered allExpenses,
 * build 12 months (Jan–Dec) for current year and sum amount by month.
 * Uses create_date for grouping; items without create_date are skipped.
 */
export function useMonthlyExpenseData(
  expenses: Array<{ amount: number; create_date?: string }>
): MonthlyDataItem[] {
  return useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentYear = new Date().getFullYear();
    const monthlyTotals = months.map((month) => ({ month, amount: 0 }));

    expenses.forEach((expense) => {
      if (!expense.create_date) return;
      const expenseDate = new Date(expense.create_date);
      if (expenseDate.getFullYear() === currentYear) {
        const monthIndex = expenseDate.getMonth();
        monthlyTotals[monthIndex].amount += expense.amount;
      }
    });

    return monthlyTotals;
  }, [expenses]);
}

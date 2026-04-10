import { useMemo } from "react";
import { useExpenses } from "@/features/4_2_dashboard/hooks/useExpenses";

export function useBillsDashboardStats() {
  const { expenses = [], isLoading } = useExpenses();

  const recurringBills = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          expense.is_recurring &&
          !expense.recurring_settlement_for_expense_id &&
          !expense.exclude_from_reminder_bills
      ),
    [expenses]
  );

  const totalRecurringBills = useMemo(
    () => recurringBills.length,
    [recurringBills]
  );

  const dueThisWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recurringBills.filter((expense) => {
      if (!expense.next_payment_date) return false;
      const nextDate = new Date(expense.next_payment_date);
      const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0;
    }).length;
  }, [recurringBills]);

  const overdue = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recurringBills.filter((expense) => {
      if (!expense.next_payment_date) return false;
      const nextDate = new Date(expense.next_payment_date);
      return nextDate < today;
    }).length;
  }, [recurringBills]);

  const completed = useMemo(
    () => recurringBills.filter((expense) => expense.status === "paid").length,
    [recurringBills]
  );

  return {
    isLoading,
    totalRecurringBills,
    dueThisWeek,
    overdue,
    completed,
  };
}

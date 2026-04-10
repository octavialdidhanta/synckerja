import { isSameMonth, isSameYear, subMonths } from 'date-fns';
import { Expense } from '@/shared/hooks/finance/useExpenses';
import { ReminderBillsFiltersType } from '../section/ReminderBillsFilters';

function matchesReminderBillPeriod(bill: Expense, period: string | undefined): boolean {
  if (!period || period === 'all') return true;
  const raw = bill.next_payment_date || bill.create_date;
  if (!raw) return false;
  const date = new Date(raw);
  const now = new Date();
  if (period === 'this_month') return isSameMonth(date, now) && isSameYear(date, now);
  if (period === 'last_month') {
    const ref = subMonths(now, 1);
    return isSameMonth(date, ref) && isSameYear(date, ref);
  }
  if (period === 'this_year') return isSameYear(date, now);
  return true;
}

/** Metrik kartu dashboard (desktop + mobile carousel) — selaras `ReminderBillsMetricsCards`. */
export function computeReminderBillsMetricStats(expenses: Expense[]) {
  const recurringExpenses = expenses.filter(
    (expense) =>
      expense.is_recurring &&
      !expense.recurring_settlement_for_expense_id &&
      !expense.exclude_from_reminder_bills,
  );

  const dueThisWeekList = recurringExpenses.filter((expense) => {
    if (!expense.next_payment_date) return false;
    const nextDate = new Date(expense.next_payment_date);
    const today = new Date();
    const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  });

  const overdueList = recurringExpenses.filter((expense) => {
    if (!expense.next_payment_date) return false;
    const nextDate = new Date(expense.next_payment_date);
    const today = new Date();
    return nextDate < today;
  });

  const completedList = recurringExpenses.filter((expense) => expense.status === 'paid');

  const sum = (list: Expense[]) => list.reduce((s, e) => s + e.amount, 0);

  return {
    total: recurringExpenses.length,
    totalAmount: sum(recurringExpenses),
    dueThisWeek: dueThisWeekList.length,
    dueThisWeekAmount: sum(dueThisWeekList),
    overdue: overdueList.length,
    overdueAmount: sum(overdueList),
    completed: completedList.length,
    completedAmount: sum(completedList),
  };
}

/** For Paynow / recurring-link dropdown: expense-origin bills only, overdue or due within 7 days. */
export type RecurringBillPayNowEligibilityInput = {
  next_payment_date?: string | null;
  bill_source?: 'expense' | 'purchase_request';
};

export function isRecurringBillPayNowEligible(
  bill: RecurringBillPayNowEligibilityInput
): boolean {
  if (bill.bill_source === 'purchase_request') return false;
  if (!bill.next_payment_date) return false;
  const dueDate = new Date(bill.next_payment_date);
  const today = new Date();
  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}

// Helper function to calculate next payment date for recurring expenses
export const calculateNextPaymentDate = (
  lastPaymentDate: string,
  recurringFrequency: string | undefined | null
): string | undefined => {
  if (!recurringFrequency) return undefined;
  
  // Normalize frequency to lowercase for case-insensitive comparison
  const normalizedFrequency = recurringFrequency.toLowerCase().trim();
  
  const lastPayment = new Date(lastPaymentDate);
  const nextPayment = new Date(lastPayment);
  
  switch (normalizedFrequency) {
    case 'daily':
      nextPayment.setDate(nextPayment.getDate() + 1);
      break;
    case 'weekly':
      nextPayment.setDate(nextPayment.getDate() + 7);
      break;
    case 'biweekly':
    case 'bi-weekly':
      nextPayment.setDate(nextPayment.getDate() + 14);
      break;
    case 'monthly':
      nextPayment.setMonth(nextPayment.getMonth() + 1);
      break;
    case 'quarterly':
      nextPayment.setMonth(nextPayment.getMonth() + 3);
      break;
    case 'semiannually':
    case 'semi-annually':
      nextPayment.setMonth(nextPayment.getMonth() + 6);
      break;
    case 'annually':
      nextPayment.setFullYear(nextPayment.getFullYear() + 1);
      break;
    default:
      console.warn('Unknown recurring frequency:', recurringFrequency);
      return undefined;
  }
  
  return nextPayment.toISOString().split('T')[0];
};

export const filterReminderBills = (
  expenses: Expense[],
  filters: ReminderBillsFiltersType
): Expense[] => {
  // First filter only recurring expenses (bills), exclude settlement payment rows and reminder-dismissed rows
  const recurringBills = expenses.filter(
    (expense) =>
      expense.is_recurring &&
      !expense.recurring_settlement_for_expense_id &&
      !expense.exclude_from_reminder_bills
  );
  
  return recurringBills.filter((bill) => {
    if (!matchesReminderBillPeriod(bill, filters.period)) {
      return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        bill.expense_name?.toLowerCase().includes(searchLower) ||
        bill.description?.toLowerCase().includes(searchLower) ||
        bill.category?.toLowerCase().includes(searchLower) ||
        bill.expense_type?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'overdue') {
        if (!bill.next_payment_date) return false;
        const nextDate = new Date(bill.next_payment_date);
        const today = new Date();
        if (nextDate >= today) return false;
      } else if (filters.status === 'active') {
        if (bill.status === 'paid') return false;
        if (bill.next_payment_date) {
          const nextDate = new Date(bill.next_payment_date);
          const today = new Date();
          if (nextDate < today) return false; // Exclude overdue for active
        }
      } else if (bill.status !== filters.status) {
        return false;
      }
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      if (bill.category?.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
    }

    // Department filter
    if (filters.department && filters.department !== 'all') {
      if (bill.department?.toLowerCase() !== filters.department.toLowerCase()) {
        return false;
      }
    }

    return true;
  });
};

export const getUniqueBillCategories = (expenses: Expense[]): string[] => {
  const categories = new Set<string>();
  expenses
    .filter(expense => expense.is_recurring)
    .forEach((expense) => {
      if (expense.category) {
        categories.add(expense.category);
      }
    });
  return Array.from(categories).sort();
};

export const getUniqueBillDepartments = (expenses: Expense[]): string[] => {
  const departments = new Set<string>();
  expenses
    .filter(expense => expense.is_recurring)
    .forEach((expense) => {
      if (expense.department) {
        departments.add(expense.department);
      }
    });
  return Array.from(departments).sort();
};

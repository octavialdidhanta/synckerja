import type { Expense } from '@/shared/hooks/finance/useExpenses';
import type { AddExpensePrefillPayload } from '../components/DesktopAddNewExpenseModal';

/** Prefill payload for paying a recurring bill (same mapping as mobile BillsTableSection). */
export function buildReminderBillPayNowPrefill(bill: Expense): AddExpensePrefillPayload {
  return {
    source_bill_id: bill.id,
    expense_name: bill.expense_name,
    amount: bill.amount,
    expense_type: bill.expense_type,
    category: bill.category,
    department: bill.department ?? '',
    recurring_frequency: bill.recurring_frequency,
    next_payment_date: bill.next_payment_date,
    bill_create_date: bill.create_date,
  };
}

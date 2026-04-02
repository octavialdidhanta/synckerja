
import { z } from 'zod';

export const addExpenseSchema = z.object({
  expense_name: z.string().min(1, 'Expense name is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  expense_type: z.string().min(1, 'Expense type is required'),
  category: z.string().min(1, 'Category is required'),
  department: z.string().optional(),
  withdrawal_from_balance: z.union([z.string(), z.literal('none')]).optional(), // Debt ID for withdrawal from balance
  bank_account_id: z.string().optional(), // Bank account ID for withdrawal from balance
  create_date: z.string().min(1, 'Create date is required'),
  is_recurring: z.boolean().default(false),
  recurring_frequency: z.string().optional(),
  first_payment_date: z.string().optional(),
  /** Link payment to existing recurring bill (Paynow / share); optional for brand-new recurring. */
  linked_recurring_expense_id: z.string().optional(),
  description: z.string().optional(),
}).refine(
  (data) => {
    const hasDebt = data.withdrawal_from_balance && data.withdrawal_from_balance !== 'none';
    const hasBank = !!data.bank_account_id;
    return hasDebt || hasBank;
  },
  { message: 'Withdrawal From Balance is required. Please select a Bank Account or Debt.', path: ['withdrawal_from_balance'] }
);

export type AddExpenseFormData = z.infer<typeof addExpenseSchema>;

export const RECURRING_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannually', label: 'Semi-annually' },
  { value: 'annually', label: 'Annually' },
] as const;

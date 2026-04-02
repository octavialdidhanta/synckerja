import { useMemo } from 'react';
import { AddNewExpenseModal } from './DesktopAddNewExpenseModal';
import { useExpenses, type Expense } from '@/shared/hooks/finance';
import { buildReminderBillPayNowPrefill } from '../utils/reminderBillPayNowPrefill';

export interface ReminderBillPayNowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Expense | null;
}

/** Desktop reminder-bills Pay now — modal via `DesktopAddNewExpenseModal`, post-success via `useExpenses`. */
export function ReminderBillPayNowModal({ open, onOpenChange, bill }: ReminderBillPayNowModalProps) {
  const { updateRecurringBillAfterPayNow, refetch } = useExpenses();

  const prefillData = useMemo(() => (bill ? buildReminderBillPayNowPrefill(bill) : undefined), [bill]);

  return (
    <AddNewExpenseModal
      open={open}
      onOpenChange={onOpenChange}
      prefillData={prefillData}
      onAfterCreateExpenseSuccess={async ({ linked_recurring_source_id, create_date }) => {
        if (!linked_recurring_source_id) return;
        await updateRecurringBillAfterPayNow(linked_recurring_source_id, create_date);
        await refetch();
      }}
    />
  );
}

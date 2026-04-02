// Reminder Bills Module
export { ReminderBillsPage } from './pages/ReminderBillsPage';
export { ReminderBillPayNowModal } from './components/ReminderBillPayNowModal';
export {
  AddNewExpenseModal as DesktopAddNewExpenseModal,
  type AddNewExpenseModalProps as DesktopAddNewExpenseModalProps,
  type AddExpensePrefillPayload,
  type AddExpenseAfterSuccessPayload,
  shortExpenseIdForDisplay,
} from './components/DesktopAddNewExpenseModal';
export { buildReminderBillPayNowPrefill } from './utils/reminderBillPayNowPrefill';

// Re-export hooks from dashboard for convenience
export { useExpenses, useExpenseMetrics } from '@/shared/hooks/finance';


/**
 * Desktop entry: same behavior as base modal, with square viewport (w≈h) + sharp corners on desktop.
 * Mobile routes should import `@/4-2-reminder-bills/modal/AddNewExpenseModal` (no square shell).
 */
import {
  AddNewExpenseModal as BaseAddNewExpenseModal,
  type AddNewExpenseModalProps,
  type AddExpensePrefillPayload,
  type AddExpenseAfterSuccessPayload,
  shortExpenseIdForDisplay,
} from '@/4-2-reminder-bills/modal/AddNewExpenseModal';

export function AddNewExpenseModal(props: AddNewExpenseModalProps) {
  return <BaseAddNewExpenseModal {...props} desktopSquareCorners />;
}

export type { AddNewExpenseModalProps, AddExpensePrefillPayload, AddExpenseAfterSuccessPayload };
export { shortExpenseIdForDisplay };

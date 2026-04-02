// Main Dashboard
export { ExpenseDashboard } from './components/ExpenseDashboard';
export { HeaderAndTab } from './section/HeaderAndTab';

// Tab Pages
// PaymentProcessPage moved to 4_2_payment-process module
// ApprovalsPage moved to 4_2_approvals module
// ReminderBillsPage moved to 4_2_reminder-bills module
// PayrollExpensePage moved to 4_2_payroll module
// ApprovalRequestsPage moved to 4_2_approvals module

// Tables
// ApprovalRequestsTable moved to 4_2_approvals module
// PaymentRequestsTable moved to 4_2_payment-process module
// ReminderBillsTable moved to 4_2_reminder-bills module
// PayrollExpenseTable moved to 4_2_payroll module

// Metrics Cards
// ApprovalMetricsCards and ApprovalRequestsMetricsCards moved to 4_2_approvals module
// PaymentMetricsCards moved to 4_2_payment-process module
// ReminderBillsMetricsCards moved to 4_2_reminder-bills module
// PayrollExpenseMetricsCards moved to 4_2_payroll module

// Filters
// ApprovalFilters and ApprovalRequestsFilters moved to 4_2_approvals module
// PaymentFilters moved to 4_2_payment-process module
// ReminderBillsFilters moved to 4_2_reminder-bills module
// PayrollExpenseFilters moved to 4_2_payroll module

// Overviews
// RecentApprovalsOverview moved to 4_2_approvals module
// RecentPaymentsOverview moved to 4_2_payment-process module
// ReminderBillsOverview moved to 4_2_reminder-bills module
// PayrollExpenseOverview moved to 4_2_payroll module

// Modals & Dialogs
// PurchaseRequestDetailsModal moved to 4_2_approvals module
// PaymentRequestDetailDialog moved to 4_2_payment-process module
export { DepartmentCrudModal } from './components/DepartmentCrudModal';
export { ExpenseTypeCrudModal } from './components/ExpenseTypeCrudModal';
export { ExpenseCategoryCrudModal } from './components/ExpenseCategoryCrudModal';

// Dropdowns
export { ActionsDropdown } from './components/ActionsDropdown';
// ApprovalActionsDropdown moved to 4_2_approvals module

// Hooks (canonical implementations live in @/shared/hooks/finance)
export {
  useExpenses,
  useExpenseTypes,
  useExpenseCategories,
  useExpenseMetrics,
  useDebtsForExpense,
  useCreateReimbursementRequest,
  useCreateCashAdvanceRequest,
} from "@/shared/hooks/finance";
export type {
  Expense,
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseType,
  CreateExpenseTypeData,
  UpdateExpenseTypeData,
  ExpenseCategory,
  CreateExpenseCategoryData,
} from "@/shared/hooks/finance";

// Types
export * from './types';


# Expenses Management Module

This module contains all components related to Expenses Management (`/expenses/*`).

## Structure

```
4_2_dashboard/
├── Main Dashboard/
│   └── ExpenseDashboard.tsx           # Main expenses dashboard
│
├── Tab Pages/
│   ├── ApprovalsPage.tsx              # Approval requests page
│   ├── PaymentProcessPage.tsx         # Payment processing page
│   ├── ReminderBillsPage.tsx          # Bills reminder page
│   ├── PayrollExpensePage.tsx         # Payroll expenses page
│   └── ApprovalRequestsPage.tsx       # Approval requests management
│
├── Tables/
│   ├── ApprovalRequestsTable.tsx
│   ├── PaymentRequestsTable.tsx
│   ├── ReminderBillsTable.tsx
│   └── PayrollExpenseTable.tsx
│
├── Metrics Cards/
│   ├── ApprovalMetricsCards.tsx
│   ├── ApprovalRequestsMetricsCards.tsx
│   ├── PaymentMetricsCards.tsx
│   ├── ReminderBillsMetricsCards.tsx
│   └── PayrollExpenseMetricsCards.tsx
│
├── Filters/
│   ├── ApprovalFilters.tsx
│   ├── ApprovalRequestsFilters.tsx
│   ├── PaymentFilters.tsx
│   ├── ReminderBillsFilters.tsx
│   └── PayrollExpenseFilters.tsx
│
├── Overviews/
│   ├── RecentApprovalsOverview.tsx
│   ├── RecentPaymentsOverview.tsx
│   ├── ReminderBillsOverview.tsx
│   └── PayrollExpenseOverview.tsx
│
├── Modals & Dialogs/
│   ├── PurchaseRequestDetailsModal.tsx
│   ├── PaymentRequestDetailDialog.tsx
│   ├── DepartmentCrudModal.tsx
│   ├── ExpenseTypeCrudModal.tsx
│   └── ExpenseCategoryCrudModal.tsx
│
├── Dropdowns/
│   ├── ActionsDropdown.tsx
│   └── ApprovalActionsDropdown.tsx
│
├── hooks/
│   ├── useExpenses.ts
│   ├── useExpenseMetrics.ts
│   ├── useExpenseTypes.ts
│   ├── useExpenseCategories.ts
│   ├── useReimbursementRequests.ts
│   ├── useCashAdvanceRequests.ts
│   └── index.ts
│
├── types/
│   ├── reimbursement.ts
│   └── index.ts
│
├── index.ts                           # Module exports
└── README.md                          # This file
```

## Main Tabs

### ExpenseDashboard
Main dashboard showing expense overview and statistics.

**Route:** `/expenses/dashboard`

**Features:**
- Total expenses metrics
- Expense breakdown by category/type
- Monthly expense trends
- Recent expense transactions
- Quick actions (Add Expense, Create Report)

### ApprovalsPage
Expense approval management page.

**Route:** `/expenses/approvals`

**Features:**
- Pending approval requests
- Approval/rejection workflow
- Approval history
- Metrics (Pending, Approved, Rejected)
- Filters (Status, Type, Date, Amount)

### PaymentProcessPage
Payment processing page for approved expenses.

**Route:** `/expenses/payment-process`

**Features:**
- Payment queue
- Payment status tracking
- Payment method management
- Payment history
- Batch payment processing

### ReminderBillsPage
Recurring bills and payment reminders.

**Route:** `/expenses/reminder-bills`

**Features:**
- Upcoming bill reminders
- Overdue bills alerts
- Recurring bill setup
- Bill payment tracking
- Auto-reminder notifications

### PayrollExpensePage
Payroll-related expenses page.

**Route:** `/expenses/payroll`

**Features:**
- Payroll expense breakdown
- Salary payments
- Tax deductions
- Benefits and allowances
- Monthly payroll summary

## Hooks

### useExpenses
Main hook for expense CRUD operations.

**Returns:**
- `expenses`: Array of expenses
- `isLoading`: Loading state
- `createExpense`: Create function
- `updateExpense`: Update function
- `deleteExpense`: Delete function

### useExpenseMetrics
Calculates expense metrics and statistics.

**Returns:**
- `totalExpenses`: Total amount
- `categoryBreakdown`: Expenses by category
- `monthlyTrend`: Monthly comparison
- `topExpenses`: Highest expenses

### useExpenseTypes
Manages expense types (categories).

**Returns:**
- `expenseTypes`: Array of types
- `createExpenseType`: Create function
- `updateExpenseType`: Update function
- `deleteExpenseType`: Delete function

### useExpenseCategories
Manages expense categories.

**Returns:**
- `expenseCategories`: Array of categories
- `createExpenseCategory`: Create function
- `updateExpenseCategory`: Update function
- `deleteExpenseCategory`: Delete function

### useReimbursementRequests
Manages employee reimbursement requests.

**Returns:**
- `reimbursements`: Array of requests
- `createReimbursement`: Submit request
- `approveReimbursement`: Approve request
- `rejectReimbursement`: Reject request

### useCashAdvanceRequests
Manages cash advance requests.

**Returns:**
- `cashAdvances`: Array of requests
- `createCashAdvance`: Submit request
- `approveCashAdvance`: Approve request
- `rejectCashAdvance`: Reject request

## Database Schema

### expenses table
- `id`: UUID
- `organization_id`: UUID
- `expense_date`: Date
- `description`: Text
- `amount`: Decimal
- `category_id`: UUID
- `type_id`: UUID
- `department_id`: UUID
- `status`: Enum (pending, approved, paid, cancelled)
- `payment_method`: Text
- `receipt_url`: Text
- `is_recurring`: Boolean
- `recurring_frequency`: Text

### expense_categories table
- `id`: UUID
- `name`: Text
- `description`: Text
- `organization_id`: UUID

### expense_types table
- `id`: UUID
- `name`: Text
- `category_id`: UUID
- `organization_id`: UUID

### reimbursement_requests table
- `id`: UUID
- `employee_id`: UUID
- `amount`: Decimal
- `description`: Text
- `status`: Enum
- `receipt_url`: Text
- `approved_by`: UUID
- `approved_at`: Timestamp

## Usage

```tsx
import { ExpenseDashboard } from '@/components/1_halaman/4_2_dashboard';

// In Expenses.tsx
<TabsContent value="dashboard">
  <ExpenseDashboard />
</TabsContent>
```

## Integration Points

- **Routing:** `/expenses/dashboard`, `/expenses/approvals`, etc.
- **Database:** Multiple expense-related tables
- **Hooks:** Expense CRUD, metrics, types, categories
- **Forms:** AddExpenseForm with validation
- **Storage:** Receipt uploads to Supabase Storage

## Future Enhancements

- [ ] Budget tracking and alerts
- [ ] Multi-currency support
- [ ] Tax calculation automation
- [ ] Vendor management
- [ ] Purchase order system
- [ ] Expense analytics dashboard
- [ ] Export to accounting software
- [ ] Mobile expense submission
- [ ] OCR for receipt scanning
- [ ] Automated categorization (AI)




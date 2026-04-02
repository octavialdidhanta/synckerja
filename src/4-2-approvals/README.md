# Expenses Approvals Module

This module contains all components related to Expense Approvals (`/expenses/approvals`).

## Structure

```
4_2_approvals/
├── ApprovalsPage.tsx                  # Main approvals page
├── ApprovalRequestsPage.tsx           # Approval requests management
├── ApprovalRequestsTable.tsx          # Requests table
├── ApprovalRequestsFilters.tsx        # Approval filters
├── ApprovalRequestsMetricsCards.tsx   # Metrics cards
├── ApprovalFilters.tsx                # General filters
├── ApprovalMetricsCards.tsx           # General metrics
├── RecentApprovalsOverview.tsx        # Recent approvals sidebar
├── ApprovalActionsDropdown.tsx        # Actions dropdown
├── index.ts                           # Module exports
└── README.md                          # This file
```

## Components

### ApprovalsPage
Main page for expense approval workflow.

**Features:**
- Pending approval requests list
- Approve/reject actions
- Approval history
- Metrics cards
- Filters by status, type, amount, date

### ApprovalRequestsPage
Detailed approval requests management.

**Features:**
- Full request details
- Bulk approval/rejection
- Request filtering and search
- Export to Excel/CSV
- Approval workflow tracking

### ApprovalRequestsTable
Table displaying all approval requests.

**Columns:**
- Request ID
- Requester (Employee)
- Department
- Type (Reimbursement, Cash Advance, Purchase)
- Amount
- Date
- Status (Pending, Approved, Rejected)
- Actions (View, Approve, Reject)

**Features:**
- Sort by any column
- Search by requester name
- Filter by status, type, amount range
- Pagination
- Row selection for bulk actions

### ApprovalFilters
Filter controls for approval list.

**Filters:**
- Status (All, Pending, Approved, Rejected)
- Type (All, Reimbursement, Cash Advance, Purchase)
- Date range
- Amount range (min/max)
- Department
- Requester

### ApprovalMetricsCards
Metrics cards showing approval statistics.

**Metrics:**
- Total Pending Approvals
- Approved Today
- Rejected This Week
- Average Approval Time
- Total Amount Pending

### RecentApprovalsOverview
Sidebar showing recent approval activities.

**Features:**
- Last 10 approvals
- Quick approve button
- Approval timeline
- Top requesters
- Upcoming deadlines

### ApprovalActionsDropdown
Actions dropdown for each approval request.

**Actions:**
- View Details
- Approve
- Reject
- Request More Info
- View History
- Download Receipt

## Approval Workflow

```
Employee submits request
    ↓
Request appears in Pending list
    ↓
Manager/Admin reviews
    ↓
Approve → Move to Payment Process
    ↓
Reject → Notify employee
```

## Approval Types

### Reimbursement
Employee expense reimbursement requests.

**Fields:**
- Expense description
- Amount
- Receipt attachment
- Category
- Date

### Cash Advance
Cash advance requests before expense.

**Fields:**
- Purpose
- Amount requested
- Expected expense date
- Justification

### Purchase Request
Purchase order approval.

**Fields:**
- Items list
- Total amount
- Supplier
- Delivery date
- Budget allocation

## Database Schema

### reimbursement_requests table
- `id`: UUID
- `employee_id`: UUID
- `amount`: Decimal
- `description`: Text
- `status`: Enum (pending, approved, rejected)
- `receipt_url`: Text
- `requested_at`: Timestamp
- `approved_by`: UUID
- `approved_at`: Timestamp
- `rejection_reason`: Text

## Usage

```tsx
import { ApprovalsPage } from '@/components/1_halaman/4_2_approvals';

// In Expenses.tsx
<TabsContent value="approvals">
  <ApprovalsPage />
</TabsContent>
```

## Integration Points

- **Routing:** `/expenses/approvals`
- **Database:** `reimbursement_requests`, `cash_advance_requests`, `purchase_requests`
- **Hooks:** Re-uses from `4_2_dashboard/hooks`
- **Notifications:** Toast notifications for approval actions
- **Permissions:** Only Manager/Admin can approve

## Future Enhancements

- [ ] Multi-level approval workflow
- [ ] Approval delegation
- [ ] Auto-approval rules (amount thresholds)
- [ ] Approval notifications (email/push)
- [ ] Approval analytics dashboard
- [ ] Approval templates
- [ ] Budget approval integration
- [ ] Mobile approval app
- [ ] Approval audit trail
- [ ] SLA tracking for approvals




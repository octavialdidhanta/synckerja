# Income Transaction Module

This module contains the Transaction page for Income Management (`/incomes/transaction`) and the **Piutang** sub-module (`/incomes/piutang`).

## Income allocation (post–lead conversion)

Payments recorded from **paid livechat conversion** create `income_transactions` with `status: pending`, **`bank_account_id`** set to the org’s exclusive **Omnichannel** bank (toggle on **Bank Accounts** tab), and **no** `income_type_id` / `category_id` (table shows **Unknown** for type/category). Bank balance is **not** updated until Owner/Admin completes allocation on `/incomes/transaction` via **Allocate** (`IncomeAllocationDialog`).

Legacy or non-livechat conversions without Omnichannel may still have null `bank_account_id` until allocation.

- Required to complete: income type, category (or Other + label), bank account (preset bank is locked in the allocation dialog when already set).
- **Omnichannel bank:** exactly one active `bank_accounts` row per org with `use_for_omnichannel_income = true`. Paid livechat conversion is blocked if none is configured.
- Only **Owner** and **Admin** can allocate or edit classification; HR can view the page.
- Metrics and dashboard totals count **`completed`** status only.

### Optional legacy SQL (run once in Supabase)

```sql
UPDATE income_transactions
SET status = 'pending'
WHERE status = 'completed'
  AND (bank_account_id IS NULL OR income_type_id IS NULL OR category_id IS NULL);
```

### QA matrix (Omnichannel bank + allocation)

1. No Omnichannel toggle ON → paid livechat conversion blocked with clear message.
2. One account ON → conversion succeeds → income `pending` with `bank_account_id` filled.
3. Bank balance unchanged immediately after conversion.
4. After allocation (type + category) → `completed` and balance increases by transaction amount.
5. Move Omnichannel toggle to another account → new conversions use new account; old rows keep prior `bank_account_id`.
6. All toggles OFF → conversions blocked again.
7. Manual income create with bank but missing type/category → no balance credit until allocation complete.

## Piutang (`piutang/`)

Sales receivables from `sales_activities` (with payments). Route: **`/incomes/piutang`**. Uses the same shell as transactions (`IncomeTransactionModuleShell`). Access control matches **`/incomes/transaction`** until a dedicated ACL path exists.

Legacy payments may not have a linked `income_transactions.sales_activity_payment_id` (no automatic backfill); new payments created from the visit payment modal are linked 1:1.

```
piutang/
├── pages/           # IncomePiutangShellPage, IncomePiutangPage
├── components/      # Filters, table, verification drawer
├── hooks/           # usePiutangActivityRows
├── utils/           # piutangFilter
├── types/
├── skeletons/
└── index.ts         # Lazy route imports
```

## Structure

```
4-1-transaction/
├── IncomeTransactionPage.tsx      # Main transaction page layout
├── section/                        # Section components
│   ├── IncomeTransactionFilters.tsx
│   ├── IncomeTransactionMetricsCards.tsx
│   ├── IncomeTransactionTable.tsx
│   ├── IncomeTransactionTableFooter.tsx
│   ├── IncomeTransactionOverview.tsx
│   ├── IncomeTransactionSidebarFooter.tsx
│   └── index.ts                    # Section exports
├── utils/                          # Utility functions
│   └── transactionUtils.ts         # Filter and helper functions
├── index.ts                        # Module exports
└── README.md                       # This file
```

## Components

### Main Page
- **IncomeTransactionPage.tsx**: Main page component that orchestrates all sections, following the same structure as EmployeePage

### Section Components
- **IncomeTransactionFilters**: Filter component for search, status, type, and category
- **IncomeTransactionMetricsCards**: Metrics cards displaying income statistics (reuses from dashboard)
- **IncomeTransactionTable**: Table component displaying income transactions
- **IncomeTransactionTableFooter**: Footer component for table with summary information
- **IncomeTransactionOverview**: Sidebar overview component showing income summary
- **IncomeTransactionSidebarFooter**: Footer component for sidebar

### Utilities
- **transactionUtils.ts**: 
  - `filterTransactions`: Filter transactions based on criteria
  - `getUniqueIncomeTypes`: Get unique income types from transactions
  - `getUniqueIncomeCategories`: Get unique income categories from transactions

## Layout Structure

The page follows the same layout structure as the Employee page:

```
StandardLayout
└── Main Container (h-screen bg-gray-100)
    └── Grid Layout (12 columns)
        ├── Main Content (9 columns)
        │   ├── Filter Section
        │   ├── Metrics Cards Section
        │   └── Table Section (with seamless-scroll)
        └── Sidebar (3 columns)
            ├── Sidebar Header
            ├── Overview Content (scrollable)
            └── Sidebar Footer
```

## Features

- **Filtering**: Search, status, type, and category filters
- **Metrics**: Display income metrics in cards
- **Table**: Full-featured transaction table with actions
- **Overview**: Sidebar overview with quick stats
- **Add Income**: Dialog to add new income transactions
- **Responsive**: Grid-based layout that adapts to screen size

## Usage

```tsx
import { IncomeTransactionPage } from '@/features/4-1-transaction';

// In routing
<Route path="/incomes/transaction" element={
  <ProtectedRoute>
    <StandardLayout>
      <IncomeTransactionPage />
    </StandardLayout>
  </ProtectedRoute>
} />
```

## Styling

- Uses the same styling patterns as Employee page
- Consistent spacing, colors, and typography
- `seamless-scroll` class for smooth scrolling
- `max-h-[calc(100vh-120px)]` for proper height constraints

# Income Transaction Module

This module contains the Transaction page for Income Management (`/incomes/transaction`) and the **Piutang** sub-module (`/incomes/piutang`).

## Income deposit validation

Income status lifecycle:

| Status | Meaning | Bank balance |
|--------|---------|--------------|
| `pending` | Deposit not confirmed (struk uploaded ≠ uang masuk) | No credit |
| `deposited` | Deposit confirmed (piutang OK or Xendit webhook) | Credited once |
| `completed` | Deposit confirmed + type/category/bank allocated | No extra credit |
| `cancelled` | Rejected / voided before deposit | No credit |

- **Manual (livechat / bank transfer + receipt):** conversion creates `pending` income → finance verifies transfer in **Piutang → Verifikasi** → RPC `confirm_income_bank_deposit` → `deposited` + balance credit → **Allocate** → `completed`.
- **Xendit VA:** **Koleksi VA** (Payment History or Piutang) → client pays → `apply_xendit_va_settlement` → `deposited` + balance on Xendit income bank → **Allocate** → `completed`.
- VA collection is **not** in the verification drawer (verification = match receipt to bank statement only).
- Only **Owner/Admin** can confirm deposit (RPC) and allocate.

## Income allocation (post–lead conversion)

Payments recorded from **paid livechat conversion** create `income_transactions` with `status: pending`, **`bank_account_id`** set to the org’s exclusive **Omnichannel** bank, and **no** `income_type_id` / `category_id`. Bank balance is **not** updated until deposit is confirmed (piutang verification OK) and then allocation completes the row to `completed`.

Legacy or non-livechat conversions without Omnichannel may still have null `bank_account_id` until allocation.

- Required to complete: deposit confirmation, then income type, category (or Other + label), bank account.
- **Omnichannel bank:** exactly one active `bank_accounts` row per org with `use_for_omnichannel_income = true`. Paid livechat conversion is blocked if none is configured.
- Only **Owner** and **Admin** can verify deposit, allocate, or edit classification; HR can view the page.
- Metrics and dashboard totals count **`completed`** status only.

### QA matrix (deposit + allocation)

1. Conversion with receipt → income `pending`, balance unchanged.
2. Piutang verifikasi OK (Owner/Admin) → `deposited`, balance +amount on omnichannel bank.
3. Piutang ditolak → linked income `cancelled` if not yet deposited.
4. Allocate type/category on `deposited` row → `completed` (no double balance credit).
5. Xendit VA paid → auto `deposited` + balance on Xendit income bank; piutang auto-OK.
6. Manual bank transfer with receipt → **Koleksi VA** hidden; use verifikasi only.

## Brick bank mutations

- Link company bank accounts to **Brick** from **Bank Accounts** tab (`/incomes/transaction`).
- **Refresh mutasi semua rekening** pulls ledger data for all `brick_link_status = linked` accounts (manual v1; rate limit 1/org/2min).
- Mutations appear in **Mutasi bank** panel; matching suggests pending income + unchecked piutang when amount/date/account align (±1 day, exact amount).
- Finance **Konfirmasi** on a suggestion → RPC `confirm_bank_mutation_match` → `deposit_source = brick_mutasi`, piutang approved, ERP balance credited (same as manual OK).
- **Piutang → Verifikasi** shows a green banner when a suggested match exists for that payment.
- Saldo **ERP vs Brick** shown per linked account for drift visibility.
- Edge secrets: `BRICK_CLIENT_ID`, `BRICK_CLIENT_SECRET`; dev mock: `BRICK_USE_MOCK=true`. See `supabase/functions/brick-bank-sync/README.md`.

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

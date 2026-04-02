# Incomes Dashboard Module

This module contains all components related to the Incomes/Revenue Management page (`/incomes/*`).

## Structure

```
4_1_dashboard/
├── IncomeDashboard.tsx            # Main dashboard component
├── IncomeTransactionTable.tsx     # Transaction list table
├── IncomeMetricsCards.tsx         # Metrics cards
├── RecentIncomeOverview.tsx       # Recent income sidebar
├── IncomeVsExpensesChart.tsx      # Income vs Expenses chart
├── AddIncomeForm.tsx              # Add new income form
├── IncomeTransactionDialog.tsx    # Transaction detail dialog
├── index.ts                       # Module exports
└── README.md                      # This file
```

## Components

### IncomeDashboard
Main dashboard component for income management.

**Features:**
- Period selector (This Month, Last Month, This Quarter, etc.)
- Type filter (All Types, Sales, Services, etc.)
- Year selector for charts
- Metrics cards (Total Income, Highest, Latest)
- Monthly income trend chart
- Income vs Expenses comparison
- Recent transactions list

**Charts:**
- Monthly income bar chart
- Income vs Expenses line chart
- Year-over-year comparison

### IncomeTransactionTable
Table displaying all income transactions.

**Columns:**
- Date
- Description
- Category/Type
- Amount (Rupiah)
- Status
- Actions

**Features:**
- Search by description
- Filter by type, status, date range
- Sort by amount, date
- Edit/Delete transactions
- Export to CSV/Excel

### IncomeMetricsCards
Metrics cards showing income statistics.

**Metrics:**
- Total Income (current period)
- Highest Transaction
- Latest Transaction
- Growth percentage

**Visual Indicators:**
- Color-coded by performance
- Trend arrows (up/down)
- Comparison with previous period

### RecentIncomeOverview
Sidebar component showing recent income activities.

**Features:**
- Recent transactions (last 10)
- Quick stats
- Top income sources
- Upcoming expected income
- Calendar view of income dates

### IncomeVsExpensesChart
Comparison chart showing income vs expenses over time.

**Features:**
- Line chart with two series
- Income (green line)
- Expenses (red line)
- Net profit calculation
- Profit margin percentage
- Monthly/Quarterly/Yearly view

### AddIncomeForm
Form for adding new income transactions.

**Fields:**
- Date *
- Description *
- Amount *
- Category/Type *
- Payment method
- Invoice number
- Customer/Client
- Notes
- Attachment

**Validation:**
- Required fields
- Amount > 0
- Valid date
- Valid invoice format

### IncomeTransactionDialog
Dialog for viewing/editing transaction details.

**Features:**
- View full transaction details
- Edit mode
- Status update
- Add notes/attachments
- View related documents
- Transaction history

## Data Flow

```
User Action
    ↓
AddIncomeForm / IncomeTransactionDialog
    ↓
useIncomeTransactions hook
    ↓
Supabase (income_transactions table)
    ↓
React Query Cache
    ↓
IncomeDashboard / IncomeTransactionTable
```

## Hooks

### useIncomeMetrics
Calculates aggregated income metrics.

**Returns:**
- `totalIncome`: Total for period
- `highestTransaction`: Largest single income
- `latestTransaction`: Most recent income
- `growthPercentage`: Period-over-period growth

### useIncomeTransactions
Fetches and manages income transactions.

**Returns:**
- `incomeTransactions`: Array of transactions
- `isLoading`: Loading state
- `createTransaction`: Add function
- `updateTransaction`: Update function
- `deleteTransaction`: Delete function

### useMonthlyIncomeData
Fetches monthly aggregated income data for charts.

**Returns:**
- `data`: Array of monthly totals
- `isLoading`: Loading state

## Database Schema

### income_transactions table
- `id`: UUID primary key
- `organization_id`: UUID foreign key
- `transaction_date`: Date of income
- `description`: Transaction description
- `amount`: Income amount (decimal)
- `category`: Income category
- `payment_method`: Payment type
- `invoice_number`: Invoice reference
- `customer_client`: Customer name
- `status`: Transaction status (pending, completed, cancelled)
- `notes`: Additional notes
- `attachment_url`: Document URL
- `created_at`, `updated_at`: Timestamps

## Usage

```tsx
import { IncomeDashboard } from '@/components/1_halaman/4_1_dashboard';

// In Incomes.tsx
<TabsContent value="dashboard">
  <IncomeDashboard />
</TabsContent>
```

## Integration Points

- **Routing:** `/incomes/dashboard`, `/incomes/transaction`
- **Database:** `income_transactions` table
- **Hooks:** `useIncomeMetrics`, `useIncomeTransactions`, `useMonthlyIncomeData`
- **Charts:** Recharts library for visualizations

## Income Categories

- **Sales**: Product/service sales
- **Services**: Professional services
- **Subscriptions**: Recurring revenue
- **Investments**: Investment returns
- **Others**: Miscellaneous income

## Payment Methods

- **Bank Transfer**
- **Cash**
- **Credit Card**
- **E-wallet** (GoPay, OVO, Dana, etc.)
- **Others**

## Transaction Status

- **Pending**: Awaiting payment
- **Completed**: Payment received
- **Cancelled**: Transaction cancelled
- **Refunded**: Payment refunded

## Future Enhancements

- [ ] Recurring income setup
- [ ] Automated invoice generation
- [ ] Payment reminders
- [ ] Multi-currency support
- [ ] Tax calculation integration
- [ ] Profit margin analysis
- [ ] Customer lifetime value tracking
- [ ] Revenue forecasting
- [ ] Integration with accounting software
- [ ] Automated bank reconciliation
- [ ] Custom report builder
- [ ] Budget vs actual comparison
- [ ] Revenue attribution (source tracking)




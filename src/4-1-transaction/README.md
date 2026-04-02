# Income Transaction Module

This module contains the Transaction page for Income Management (`/incomes/transaction`).

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

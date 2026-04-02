# Request Form Module Structure

This directory contains all request form related components organized into a clean, modular structure.

## 📁 Directory Structure

```
9_request-form/
├── pages/                    # Request form page components
│   ├── RequestForm.tsx       # Main redirect component
│   ├── Purchase.tsx          # Purchase request page
│   ├── Reimbursement.tsx     # Reimbursement request page
│   ├── CashAdvance.tsx       # Cash advance request page
│   ├── Loan.tsx              # Loan request page
│   └── index.ts
├── components/               # Request form components
│   ├── PurchaseRequestForm.tsx
│   ├── ReimbursementRequestForm.tsx
│   ├── CashAdvanceRequestForm.tsx
│   ├── LoanRequestForm.tsx
│   ├── PurchaseRequestStatusPanel.tsx
│   └── index.ts
├── hooks/                    # Request form hooks
│   ├── usePurchaseRequests.ts
│   ├── useLoanRequests.ts
│   └── index.ts
├── index.ts                  # Main module exports
└── README.md                 # This file
```

## 🎯 Component Categories

### Pages (`/pages`)
Main page components that represent different request form views:
- **RequestForm**: Redirect component that navigates to purchase by default
- **Purchase**: Purchase request form page with tabs navigation
- **Reimbursement**: Reimbursement request form page with tabs navigation
- **CashAdvance**: Cash advance request form page with tabs navigation
- **Loan**: Loan request form page with tabs navigation

### Components (`/components`)
Reusable form components used across request form pages:
- **PurchaseRequestForm**: Purchase request form component
- **ReimbursementRequestForm**: Reimbursement request form component
- **CashAdvanceRequestForm**: Cash advance request form component
- **LoanRequestForm**: Loan request form component
- **PurchaseRequestStatusPanel**: Status panel for purchase requests

### Hooks (`/hooks`)
Custom hooks for request form functionality:
- **usePurchaseRequests**: Hook for managing purchase request data
- **useLoanRequests**: Hook for managing loan request data

## 🔗 Import Usage

### From Other Modules
```typescript
// Import specific pages
import { Purchase, Reimbursement, CashAdvance, Loan } from '@/components/1_halaman/9_request-form/pages';

// Import components
import { PurchaseRequestForm, ReimbursementRequestForm } from '@/components/1_halaman/9_request-form/components';

// Import hooks
import { usePurchaseRequests, useLoanRequests } from '@/components/1_halaman/9_request-form/hooks';

// Import everything
import * from '@/components/1_halaman/9_request-form';
```

### Internal Cross-References
```typescript
// Within pages directory
import { PurchaseRequestForm } from '../components/PurchaseRequestForm';

// Within components directory
import { usePurchaseRequests } from '../hooks/usePurchaseRequests';

// Within hooks directory
import { usePurchaseRequests } from './usePurchaseRequests';
```

## 🛣️ Route Configuration

The following routes are configured in the application:

- `/request-form` → Redirects to `/request-form/purchase`
- `/request-form/purchase` → Purchase request form page
- `/request-form/reimbursement` → Reimbursement request form page
- `/request-form/cash-advance` → Cash advance request form page
- `/request-form/loan` → Loan request form page

## 🔧 Integration Points

### Used By:
- **Expenses Module**: Uses `usePurchaseRequests` hook for purchase request data
- **Main App Router**: Routes to request form pages
- **Lazy Routes**: Lazy loading configuration for request form pages

### Dependencies:
- **UI Components**: Uses shadcn/ui components (Tabs, Form, etc.)
- **Supabase**: Database integration for request data
- **React Router**: Navigation between request form pages

## ✅ Migration Status

- ✅ All files organized into logical directories
- ✅ Import references updated throughout codebase
- ✅ Route configurations updated
- ✅ Lazy loading configurations updated
- ✅ Index files created for clean exports
- ✅ Build verification successful
- ✅ No breaking changes to functionality

## 🚀 Benefits

1. **Better Organization**: Components grouped by functionality
2. **Cleaner Imports**: Index files provide clean import paths
3. **Easier Maintenance**: Related files are co-located
4. **Better Developer Experience**: Clear structure and documentation
5. **Modular Architecture**: Easy to extend with new request types

## 📝 Notes

- All request form pages share a common tab navigation structure
- Each page can be accessed independently via direct URL
- The main RequestForm component serves as a redirect to the default purchase page
- Status panels are shared across different request types for consistency

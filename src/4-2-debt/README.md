# Debt Management Module

This module contains all components related to Debt Management (`/expenses/debt`).

## Structure

```
4_2_debt/
├── DebtPage.tsx           # Main debt management page
├── index.ts               # Module exports
└── README.md              # This file
```

## Main Page

### DebtPage
Main debt management page showing debt overview and tracking.

**Route:** `/expenses/debt`

**Features:**
- Debt overview and statistics
- Debt tracking and management
- Integration with expense management system

## Integration Points

- **Routing:** `/expenses/debt`
- **Navigation:** Tab in Expense Management header (next to Dashboard tab)
- **Layout:** Uses StandardLayout with seamless-scroll and max-h-[calc(100vh-120px)]
- **Translation:** Supports Indonesian and English via useAppTranslation hook

## Usage

```tsx
import { DebtPage } from '@/features/4_2_debt';

// In App.tsx routing
<Route path="/expenses/debt" element={
  <ProtectedRoute>
    <StandardLayout>
      <DebtPage />
    </StandardLayout>
  </ProtectedRoute>
} />
```

## Future Enhancements

- [ ] Debt CRUD operations
- [ ] Debt payment tracking
- [ ] Debt reminders and notifications
- [ ] Debt analytics and reporting
- [ ] Debt categories and types
- [ ] Debt payment history
- [ ] Integration with payment processing

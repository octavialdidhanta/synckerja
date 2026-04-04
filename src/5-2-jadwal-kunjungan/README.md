# Visit Scheduling (Jadwal Kunjungan) Module

This module handles visit scheduling functionality for the operations system.

## Layout

| Folder | Contents |
|--------|----------|
| `pages/` | Route shell and page entry (`VisitSchedulingRoute`, `VisitSchedulingPage`) |
| `components/` | Feature UI (table, filters, modals, wizard host, footers, etc.) |
| `components/invoice/` | Invoice preview and template dialogs used by payment flow |
| `skeletons/` | Loading skeleton for the visit scheduling page |
| `hooks/` | Page-level hooks (e.g. skeleton gate) |
| `wizard/` | Step components for the multi-step visit wizard |

Prefer importing from the module barrel: `import { … } from '@/5-2-jadwal-kunjungan'`.

## Components

- **VisitSchedulingPage** - Main page for visit scheduling
- **VisitSchedulingList** - List of scheduled visits
- **VisitSchedulingForm** - Form for creating/editing visits
- **VisitSchedulingFilters** - Filters for visits
- **VisitSchedulingMetricsCards** - Key metrics display for visits
- **VisitSchedulingModal** - Modal for visit scheduling
- **VisitSchedulingWizard** - Multi-step wizard for visit creation
- **UpcomingVisitsOverview** - Overview of upcoming visits
- **PaymentUpdateModal** - Modal for payment updates

## Wizard Components

- **ContactStepWizard** - Contact information step
- **LocationStepWizard** - Location selection step
- **ReviewStepWizard** - Review step
- **ScheduleStepWizard** - Scheduling step
- **WizardProgress** - Progress indicator

## Usage

This module is used in the `/operations/sales/jadwal-kunjungan` route and provides comprehensive visit scheduling functionality.

## Dependencies

- Uses shared UI components from the design system
- Integrates with visit scheduling hooks and data management

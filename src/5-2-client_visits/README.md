# Client Visits Module

This module handles client visits functionality for the operations system.

## Layout (aligned with `5-2-activities`)

| Folder | Purpose |
|--------|---------|
| `pages/` | Route shell (`ClientVisitsRoute`, `ClientVisitsPage` alias) |
| `components/` | UI: table, filters, metrics, overview, footers, main grid content |
| `hooks/` | Page-level hooks (e.g. skeleton gate) |
| `skeletons/` | Loading UI |
| `index.ts` | Public exports |

## Usage

Import the page from the module barrel:

`import { ClientVisitsPage } from "@/5-2-client_visits";`

This module is used in the `/operations/sales/client-visits` route.

## Dependencies

- Uses shared UI components from the design system
- Integrates with client visits hooks and data management (`@/shared/hooks/organized/sales`, etc.)


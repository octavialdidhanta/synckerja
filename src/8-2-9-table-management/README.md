# POS Table Management (`/operations/table-management`)

Office POS module for **table groups**, floor **map**, and **table report**.

## Routes

| Path | Tab |
|------|-----|
| `/operations/table-management` | Redirect → group |
| `/operations/table-management/group` | Table Group (CRUD) |
| `/operations/table-management/map` | Table Map (canvas editor) |
| `/operations/table-management/report` | Table Report (transactions + void scaffold) |

Sidebar: POS group → **Table Management** (after Employees).

## Table Group

- Scoped by **outlet** (`?outlet=` via `useSelectedPosOutlet` + `OutletFilterSelect`).
- Create / edit sheet: name + Active status; soft delete; row duplicate (` (Copy)`).
- Columns: Table Group, Status, Table Count (from `pos_tables`).
- Data: `pos_table_groups` (org + outlet, `is_active`, soft `is_deleted`).

## Table Map

- Outlet + Table Group filters (`?outlet=` + `?group=`).
- Grid canvas with drag-and-drop; **Save Changes** batch upsert/soft-delete.
- Shapes: `circle`, `square` (pax locked 2), `rectangle` (length ≈ ceil(pax/2)), `one_sided` (length ≈ pax).
- Data: `pos_tables` (FK group, grid_x/y/w/h, rotation).
- Runtime occupancy lives on **POS-kasir-mobile** (`pos_table_sessions`).

## Table Report

- Filters: outlet, date range, per-table.
- Tabs: **Transaction** (store checkouts with table label/duration) | **Void Items** (scaffold).
- Detail drawer: order meta + ordered items.
- Data: `sales_activities` (`table_number`, `pos_table_id`, `table_duration_minutes`).

## Shared session model

- `pos_table_sessions` — open/paid/cancelled; unique one open session per table.
- Hooks: `usePosOpenTableSessions`, `usePosTableSessionMutations`, `usePosTableReport`.

## Permissions

Backoffice keys: `bo.table_management`, `.group`, `.map`, `.report` (Administrator preset includes them).

## Smoke checklist

- [ ] Nav POS → Table Management opens `/operations/table-management/group`
- [ ] Create / edit / delete / duplicate table group for selected outlet
- [ ] Table Map: add shapes, drag, edit, delete, Save; reload persists
- [ ] Table Report: filter outlet/date/table; open transaction detail
- [ ] Staff without `bo.table_management.*` do not see nav / are denied by guard

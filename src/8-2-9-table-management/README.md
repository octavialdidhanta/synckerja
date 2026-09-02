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
- Grid canvas with drag-and-drop; **Save Changes** batch upsert/soft-delete for tables **and** floor fixtures.
- Shapes: `circle`, `square` (pax locked 2), `rectangle` (length ≈ ceil(pax/2)), `one_sided` (length ≈ pax).
- Data: `pos_tables` (FK group, grid_x/y/w/h, rotation).
- Floor fixtures (cashier, stairs, door, wall, kitchen, washbasin, kiosk, parking): `pos_floor_fixtures` — layout-only, no sessions/orders; package under `fixtures/`. Walls snap to grid lines (same thickness as doors) and can be lengthened by dragging the ends.
- Toolbar **Add** → Table | Floor Item; fixtures render under tables; POS `/pos/table-map` shows them muted and non-clickable.
- Runtime occupancy lives on **POS-kasir-mobile** (`pos_table_sessions`) for tables only.

## Table Report

- Filters: outlet, date range, per-table.
- Tabs: **Transaction** (store checkouts with table label/duration) | **Void Items** (scaffold).
- Detail drawer: order meta + ordered items.
- Data: `sales_activities` (`table_number`, `pos_table_id`, `table_duration_minutes`).

## Shared session model

- `pos_table_sessions` — open/paid/cancelled; **multiple open bills per table** allowed (soft capacity: `sum(open.pax) <= table.pax`).
- Guest label: optional `customer_name` / `customer_phone` (Add Customer → bill list column).
- Occupancy helpers: `sessions/lib/tableOccupancy.ts` (`empty` | `partial` | `full`).
- Hooks: `usePosOpenTableSessions` (`sessionsByTableId: Map<tableId, session[]>`), `usePosTableSessionMutations` (new bill = always insert), `usePosTableReport`.
- POS Select Table / Table Map: partial tables open a bill picker; New Bill clamps pax to remaining capacity.

## Permissions

Backoffice keys: `bo.table_management`, `.group`, `.map`, `.report` (Administrator preset includes them).

## Smoke checklist

- [ ] Nav POS → Table Management opens `/operations/table-management/group`
- [ ] Create / edit / delete / duplicate table group for selected outlet
- Table Map: add shapes / floor items, drag, copy/paste (Ctrl+C / Ctrl+V), edit, delete, Save; reload persists
- [ ] POS Table Map: fixtures visible muted; only tables open session sheet
- [ ] Table Report: filter outlet/date/table; open transaction detail
- [ ] POS: solo guest with pax=1 on 5-top; second bill can open on same table until capacity full
- [ ] Staff without `bo.table_management.*` do not see nav / are denied by guard

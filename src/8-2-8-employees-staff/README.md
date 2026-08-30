# POS Employees Staff (`/operations/employees-staff`)

Office POS module for staff **slots**, **access roles**, and **PIN** settings. Links to HR `employees` rows without replacing `/employees`.

## Routes

| Path | Tab |
|------|-----|
| `/operations/employees-staff` | Redirect → slots |
| `/operations/employees-staff/slots` | Employee Slots |
| `/operations/employees-staff/access` | Employee Access |
| `/operations/employees-staff/pin-access` | PIN Access |

Sidebar: POS group → **Employees** (after Customers).

## Employee Access (roles)

Moka-like **roles table** (not the HR `/access-permissions` ACL page).

| Concept | Detail |
|---------|--------|
| Roles | Custom per org + system seeds **Administrator** / **Cashier** / **Kitchen** (`pos_ensure_default_roles`) |
| App Permission | Keys for `POS-kasir-mobile` (`app.pos.*`, `app.shift.*`, `app.settings.*`, `app.kitchen_display`, …) |
| Backoffice Permission | Office POS strip only: Library → Inventory (`bo.*`) |
| Assign | One staff → one `role_id`; Slots/PIN display **role name** from Access; legacy `pos_role` synced only as admin/cashier outlet bucket (`kitchen` → cashier rules) |
| Summary | App & Back-office / App Only / Back-office Only + privilege count |

Tables: `pos_employee_roles`, `pos_employee_role_permissions`, `pos_employee_staff.role_id`.

**Kitchen (system):** default permission `app.kitchen_display` only. Tablet: land `/pos/kitchen`, hard-blocked from Point of Sale (`app.pos.charge`). Requires ≥1 outlet assignment.

**Enforcement:**

### Tablet `/pos/*` (fail-closed)

- Guard: `RequirePosTabletAccess` (`POS-kasir-mobile/0-auth`) + `usePosTabletAccess`.
- **Allowed only when both:**
  1. Organization has **POS add-on active** (`organization_subscriptions.pos_addon_active` — Plans **Sertakan**; independent of extra outlet qty).
  2. User has an **active** `pos_employee_staff` row with **`role_id`** (Slot Karyawan + Access).
- **Owner / Admin do not bypass** the tablet gate without a staff slot + role.
- Without add-on → deny page CTA to `/subscription/plans`. Without slot → deny + logout.
- Loading is fail-closed (skeleton until subscription + membership ready).
- Select-outlet filters by `pos_employee_staff_outlets` (empty assignment = all active outlets).
- Soft sidebar ACL still uses `usePosAppPermissions` (`app.*`) for staff with a role (staff membership honors role keys even for Owner).
- Kitchen-only staff → `/pos/kitchen` after outlet select; cannot open `/pos/cashier` without `app.pos.charge`.
- **Realtime ACL:** `usePosStaffPermissions` subscribes to `pos_employee_role_permissions` + `pos_employee_staff` so checklist / role assign in Employee Access updates the open tablet session without reload.
- Office `/operations/employees-staff/*` remains reachable without POS add-on (so owners can invite staff before enabling).

### Office `/operations/*` (unchanged fail-open for non-staff)

- Filter Operations POS nav by backoffice keys; `PageAccessGuard` denies POS paths when staff membership lacks the key.
- **Org Owner / Admin always bypass** POS staff ACL (even if they also have a `pos_employee_staff` row, e.g. Cashier).
- Users without a staff row stay unrestricted in Office (fail-open) so HR non-POS employees are not locked out.
- Mobile soft helpers: `usePosAppPermissions` filters cashier sidebar + `can('…')` for action gates.

PIN Access stays a separate tab; App Permission form links to it.

## PIN Access (Moka-like)

| Area | Behavior |
|------|----------|
| Intro | Explains lock + links to Slots / Access; version banner (informational) |
| List of Administrator | All active **administrators** (one row per outlet); PIN column shows ready (`••••` / “PIN set”), missing, or allow-off; row opens staff detail to set PIN |
| List of Features | Checklist of `pin.feature.*` keys; **Save** upserts `pos_pin_access_settings.required_features` |
| Set PIN | Still on Employee Slots detail sheet (4 digits) |

RPCs: `pos_staff_verify_pin`, `pos_verify_admin_pin_for_outlet`. Mobile: `usePosPinAccessPolicy` + authorize dialog.

## Invite / Verified (Moka-like)

| UI (status column) | Meaning |
|------|------|
| **Invite Employee** | Empty slot → dialog New invite / Link existing |
| **Resend Invitation** | Staff pending (`verified_at` null) → resend magic-link email |
| **Verified** | `verified_at` set (magic_links completed, or legacy user without pending invite) |

- New invite: create auth user + `employees` (HR department find-or-create **Operations**, reuse `Operasional` if present) + `pos_employee_staff` + `generate-magic-link`
- Link existing: if onboarded → Verified; else send invite + pending (does **not** change HR `department_id`)
- Sync: `pos_staff_sync_verified` RPC on slots load

## Role rules (v1)

- **Administrator**: empty outlet selection → auto-assign all active outlets
- **Cashier** / **Kitchen** (legacy outlet bucket): must have ≥1 outlet on save/invite
- Soft warning if demoting last active administrator
- PIN optional for both roles; staff PIN is exactly **4 numeric digits** (set from Employee Slots detail)

## Data

- `pos_employee_staff` — POS role, `role_id`, PIN flags, `invited_at` / `verified_at`, soft `is_active`
- `pos_employee_roles` / `pos_employee_role_permissions` — custom + system roles
- `pos_employee_staff_outlets` — multi-outlet assignment
- `pos_pin_access_settings` — `required_features` + legacy bool flags
- HR `departments` — New invite find-or-create **Operations** (`lib/posOperationsDepartment.ts`); aliases reuse **Operasional**
- RPCs: `pos_staff_set_pin`, `pos_staff_clear_pin`, `pos_staff_verify_pin`, `pos_verify_admin_pin_for_outlet`, `pos_staff_set_outlets`, `pos_staff_sync_verified`, `pos_staff_is_user_verified`, `pos_ensure_default_roles`

Slot quota uses `organization_subscriptions.member_limit`.

## Smoke checklist

- [ ] Empty slot shows green **Invite Employee**; opens New invite / Link existing
- [ ] New invite sends magic-link email; row shows **Resend Invitation** until accepted
- [ ] **Resend Invitation** refreshes invite email + `invited_at`
- [ ] After first-login / completed magic_link, status becomes **Verified** (sync or on next load)
- [ ] Link existing onboarded employee → **Verified** immediately
- [ ] Cashier cannot save without ≥1 outlet; Administrator with no selection gets all outlets
- [ ] All Outlets badge only when >1 active outlets are all assigned
- [ ] Deactivate soft-disables POS staff; HR row remains
- [ ] New invite → `/employees` Department shows **Operations** (or existing Operasional); second invite does not duplicate department
- [ ] Link existing does not change HR department
- [ ] HR `/employees` navigation unchanged
- [ ] Access tab shows Administrator + Cashier after ensure defaults
- [ ] Create custom role with App + Backoffice checkboxes; assign staff; summary chips update
- [ ] Cashier role: Office POS nav hides Library…Inventory without `bo.*`; mobile sidebar hides Shift/Settings if keys off
- [ ] PIN Access: admin list + feature checklist + Save persists `required_features`
- [ ] PIN Access eye icon does not reveal digits (•••• / PIN set)
- [ ] Access assign custom role (e.g. Investor) → Slots Role column shows that name (not Cashier)
- [ ] Detail sheet / Invite role dropdown lists all org roles; save keeps `role_id`
- [ ] Owner without `pos_employee_staff` still sees full Office POS nav
- [ ] Owner who is also POS staff (e.g. Cashier) still sees Library…Inventory and is not Access-denied on POS paths
- [ ] Org Admin with staff row also unrestricted; Employee + Cashier staff still filtered
- [ ] Tablet `/pos/*`: member without Slot Karyawan → access denied page (not cashier)
- [ ] Tablet: Owner/Admin without staff row → can open select-outlet + cashier
- [ ] Tablet: active staff with role → allowed; outlets filtered by assignment (empty = all)
- [ ] Tablet: staff `is_active = false` or missing `role_id` → denied
- [ ] Stashed outlet not in assignment / not in org → cleared; redirected to select-outlet

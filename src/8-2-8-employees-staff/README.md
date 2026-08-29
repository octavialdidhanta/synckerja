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
| Roles | Custom per org + system seeds **Administrator** / **Cashier** (`pos_ensure_default_roles`) |
| App Permission | Keys for `POS-kasir-mobile` (`app.pos.*`, `app.shift.*`, `app.settings.*`, …) |
| Backoffice Permission | Office POS strip only: Library → Inventory (`bo.*`) |
| Assign | One staff → one `role_id`; Slots/PIN display **role name** from Access; legacy `pos_role` synced only as admin/cashier outlet bucket |
| Summary | App & Back-office / App Only / Back-office Only + privilege count |

Tables: `pos_employee_roles`, `pos_employee_role_permissions`, `pos_employee_staff.role_id`.

**Enforcement (v1, light):**

- Office: filter Operations POS nav by backoffice keys; `PageAccessGuard` denies POS paths when staff membership lacks the key.
- **Org Owner / Admin always bypass** POS staff ACL (even if they also have a `pos_employee_staff` row, e.g. Cashier). Enforcement applies only to non-privileged roles with an active staff membership.
- Users without a staff row stay unrestricted (fail-open).
- Mobile: `usePosAppPermissions` filters cashier sidebar + `can('…')` helpers for future action gates.

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
- **Cashier**: must have ≥1 outlet on save/invite
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

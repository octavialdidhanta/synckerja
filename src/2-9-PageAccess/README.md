# Page Access Configuration System

## Core principle

Access is driven by `permission_configurations` per organization (`roles_allowed`, exceptions, job levels).

| Role | Runtime behavior |
|------|------------------|
| **Owner** (`user_roles.role = owner`) | Always allowed on every page (toggle Owner in UI is informational only). |
| **Admin** | Must appear in `roles_allowed` for the path — toggle Admin is enforced. |
| **Employee / other** | Must appear in `roles_allowed` (or exceptions / job level rules). |

Organization founder with only an **admin** role is treated as Admin, not Owner, for page access.

## Bootstrap / first login

While profile roles or the permission matrix are still loading (`accessDecisionPending`), routes show a loading shell instead of Access Denied. `PageAccessGuard` uses `configBootstrapPending` and `centralProfileHydrated` — not full refetch loading — so tab resume does not flash deny.

## No configuration row

If there is no matching row in `permission_configurations` for a path (including parent prefix match), access is **allowed** for all roles. Add a row in **Page Access** only for routes you want to restrict; unlisted paths are not locked in HeaderAndTab.

## Files

- [`useDepartmentAccess.ts`](../shared/auth/page-access/useDepartmentAccess.ts) — `canAccessPage`, `accessDecisionPending`
- [`accessRoleSet.ts`](../shared/auth/page-access/accessRoleSet.ts) — `hasOwnerRole`, `buildEffectiveAccessRoles`
- [`PageAccessGuard.tsx`](../shared/components/PageAccessGuard.tsx) — route guard (desktop + mobile)
- [`useFilteredNavByPageAccess.ts`](../shared/auth/page-access/useFilteredNavByPageAccess.ts) — sidebar / mobile nav filtering
- [`usePermissionConfiguration.tsx`](../shared/auth/page-access/usePermissionConfiguration.tsx) — CRUD for the matrix UI

## Hierarchical paths (ancestor deny)

When multiple rows match a URL (e.g. `/omnichannel` and `/omnichannel/settings`), **every** matching row must allow the user’s role. If `/omnichannel` denies Admin, `/omnichannel/settings/user-management` is denied even when a child row allows Admin.

## Mobile web & Capacitor native

- Same `canAccessPage` / `PageAccessGuard` / `ModuleShellContentGate` as desktop.
- **`android-mobile/*` shells** must wrap main content in `ModuleShellContentGate` with the same `pagePath` as `App.tsx` (see [`mobileRoutePagePaths.ts`](../shared/auth/page-access/mobileRoutePagePaths.ts)).
- **Sidebar drawer:** menu items stay **visible** with a **padlock** when locked (`AppSidebar` / `MobileSidebarNavItem`) — not hidden.
- **Bottom footer:** tabs stay **visible** without a padlock (`MobileNavTabButton`); tap still navigates; enforcement is on the content gate only.
- `useFilteredNavByPageAccess` remains a pass-through on both chrome layers.
- Native always uses mobile shells via `useToolsModuleMobileViewport()` (Capacitor) or viewport ≤1023px.

## Department scope

`canAccessDepartment` still grants Owner/Admin cross-department data scope; that is separate from page-path toggles.

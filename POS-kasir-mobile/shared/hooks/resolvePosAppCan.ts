/** Exact key or parent key (e.g. `app` grants `app.kitchen_display`). */
export function canStaffPermissionKey(keys: Set<string>, key: string): boolean {
  if (keys.has(key)) return true;
  const parts = key.split(".");
  while (parts.length > 1) {
    parts.pop();
    if (keys.has(parts.join("."))) return true;
  }
  return false;
}

export type PosAppCanState = {
  isLoading: boolean;
  hasStaffMembership: boolean;
  permissionKeys: Set<string>;
};

/**
 * Tablet App Permission check — fail-closed.
 *
 * When the user has a POS staff row, only that role's keys apply (including for
 * org Owner/Admin). Office `unrestricted` must not unlock KDS / cashier features.
 * Without staff membership after load, deny (RequirePosTabletAccess should already block).
 */
export function resolvePosAppCan(state: PosAppCanState, key: string): boolean {
  if (state.isLoading) return false;
  if (!state.hasStaffMembership) return false;
  return canStaffPermissionKey(state.permissionKeys, key);
}

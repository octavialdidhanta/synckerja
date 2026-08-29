import type { PosStaffRole } from "./posStaffTypes";

/** Administrator defaults to all active outlets when none selected. */
export function resolveOutletIdsForRole(
  role: PosStaffRole,
  selectedOutletIds: string[],
  activeOutletIds: string[],
): string[] {
  if (role === "administrator" && selectedOutletIds.length === 0) {
    return [...activeOutletIds];
  }
  return [...selectedOutletIds];
}

export function validateOutletsForRole(
  role: PosStaffRole,
  outletIds: string[],
): { ok: true } | { ok: false; code: "cashier_needs_outlet" } {
  if (role === "cashier" && outletIds.length === 0) {
    return { ok: false, code: "cashier_needs_outlet" };
  }
  return { ok: true };
}

export function countActiveAdministrators(
  staff: Array<{ pos_role: PosStaffRole; is_active: boolean }>,
): number {
  return staff.filter((s) => s.is_active && s.pos_role === "administrator").length;
}

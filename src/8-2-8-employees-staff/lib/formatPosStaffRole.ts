import type { PosStaffRole } from "./posStaffTypes";

/** Legacy enum label (administrator | cashier) for fallbacks. */
export function formatLegacyPosRole(
  role: PosStaffRole,
  t: (key: string, fallback: string) => string,
): string {
  if (role === "administrator") {
    return t("employeesStaff.role.administrator", "Administrator");
  }
  return t("employeesStaff.role.cashier", "Cashier");
}

type StaffRoleDisplay = {
  role_name?: string | null;
  role_slug?: string | null;
  pos_role: PosStaffRole;
};

/**
 * Display name for Slots / PIN: prefer Access role name from `role_id`,
 * with i18n for system administrator/cashier when name matches slug.
 */
export function formatPosStaffRole(
  staff: StaffRoleDisplay | PosStaffRole,
  t: (key: string, fallback: string) => string,
): string {
  // Back-compat: callers that still pass the enum only
  if (typeof staff === "string") {
    return formatLegacyPosRole(staff, t);
  }

  const name = staff.role_name?.trim();
  if (name) {
    if (staff.role_slug === "administrator") {
      return t("employeesStaff.role.administrator", "Administrator");
    }
    if (staff.role_slug === "cashier") {
      return t("employeesStaff.role.cashier", "Cashier");
    }
    return name;
  }
  return formatLegacyPosRole(staff.pos_role, t);
}

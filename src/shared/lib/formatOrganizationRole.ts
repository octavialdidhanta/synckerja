import {
  buildEffectiveAccessRoles,
  hasOwnerRole,
} from "@/shared/auth/page-access/accessRoleSet";

export const ORGANIZATION_ROLES_KNOWN = [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
  "member",
] as const;

const ROLE_DISPLAY_PRIORITY = ["admin", "hr", "manager", "employee", "member"] as const;

/** Same primary role as header profile (`activeMembership.role` / `userRole`). */
export function resolvePrimaryOrganizationRole(
  userRole: string | null | undefined,
  organizationMemberRoles: string[] = [],
): string {
  const eff = buildEffectiveAccessRoles(organizationMemberRoles, userRole);
  if (hasOwnerRole(eff, userRole)) return "owner";

  const normalized = (userRole ?? "").trim().toLowerCase();
  if (normalized && (ORGANIZATION_ROLES_KNOWN as readonly string[]).includes(normalized)) {
    return normalized;
  }

  for (const role of ROLE_DISPLAY_PRIORITY) {
    if (eff.includes(role)) return role;
  }
  return "employee";
}

/** Access denied + page-access panels — matches `layout.orgSwitcher.role.*` / profile badge. */
export function formatAccessLevelLabel(
  t: (key: string, options?: Record<string, string>) => string,
  userRole: string | null | undefined,
  organizationMemberRoles: string[] = [],
): string {
  return formatOrganizationRole(
    t,
    resolvePrimaryOrganizationRole(userRole, organizationMemberRoles),
  );
}

export function formatOrganizationRole(
  t: (key: string, options?: Record<string, string>) => string,
  role: string,
): string {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return "";
  if ((ORGANIZATION_ROLES_KNOWN as readonly string[]).includes(r)) {
    return t(`layout.orgSwitcher.role.${r}`);
  }
  return t("layout.orgSwitcher.roleUnknown", { role });
}

export const ORGANIZATION_ROLES_KNOWN = [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
  "member",
] as const;

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

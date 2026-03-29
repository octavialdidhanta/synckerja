export const ORGANIZATION_ROLES_KNOWN = ["owner", "admin", "manager", "member"] as const;

export function formatOrganizationRole(
  t: (key: string, options?: Record<string, string>) => string,
  role: string,
): string {
  const r = role.toLowerCase();
  if ((ORGANIZATION_ROLES_KNOWN as readonly string[]).includes(r)) {
    return t(`layout.orgSwitcher.role.${r}`);
  }
  return t("layout.orgSwitcher.roleUnknown", { role });
}

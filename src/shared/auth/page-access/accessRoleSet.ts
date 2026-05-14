/**
 * Page access must consider every role row the user has in the org, not only the
 * single "primary" role (see `pickHighestUserRoleFromRows`). Otherwise a user with
 * both `manager` and `employee` rows gets `manager` only and fails pages that list
 * `employee` but not `manager` in `roles_allowed`.
 */
export function buildEffectiveAccessRoles(
  organizationMemberRoles: string[] | undefined,
  fallbackPrimaryRole: string | null | undefined,
): string[] {
  const raw =
    organizationMemberRoles && organizationMemberRoles.length > 0
      ? organizationMemberRoles
      : fallbackPrimaryRole
        ? [fallbackPrimaryRole]
        : [];
  const set = new Set<string>();
  for (const r of raw) {
    const x = (r || "").toLowerCase().trim();
    if (!x) continue;
    set.add(x);
    if (x === "member") set.add("employee");
    if (x === "manager") set.add("employee");
  }
  return [...set];
}

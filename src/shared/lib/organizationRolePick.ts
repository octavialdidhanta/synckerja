/** Same precedence as org switcher — lower index = higher privilege. */
export const ORGANIZATION_ROLE_PRECEDENCE = [
  "owner",
  "admin",
  "hr",
  "manager",
  "employee",
  "member",
] as const;

/**
 * Pick one canonical role when `user_roles` returns multiple rows for the same org
 * (PostgREST `.maybeSingle()` fails in that case and left `userRole` null → false denies).
 */
export function pickHighestUserRoleFromRows(rows: { role: string }[]): string | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const ia = ORGANIZATION_ROLE_PRECEDENCE.indexOf(a.role as (typeof ORGANIZATION_ROLE_PRECEDENCE)[number]);
    const ib = ORGANIZATION_ROLE_PRECEDENCE.indexOf(b.role as (typeof ORGANIZATION_ROLE_PRECEDENCE)[number]);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    return sa - sb;
  });
  return sorted[0]?.role ?? null;
}

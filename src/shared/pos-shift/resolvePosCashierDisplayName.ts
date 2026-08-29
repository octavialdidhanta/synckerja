export type ResolvePosCashierDisplayNameArgs = {
  employeeFullName?: string | null;
  profileFullName?: string | null;
  email?: string | null;
};

function emailLocalPart(email: string): string {
  const local = email.trim().split("@")[0]?.trim() ?? "";
  return local;
}

/**
 * Prefer employees.full_name (Employees Staff slots), then profiles, then email.
 */
export function resolvePosCashierDisplayName(
  args: ResolvePosCashierDisplayNameArgs,
): string {
  const employee = (args.employeeFullName ?? "").trim();
  if (employee) return employee;
  const profile = (args.profileFullName ?? "").trim();
  if (profile) return profile;
  const email = (args.email ?? "").trim();
  if (email) {
    const local = emailLocalPart(email);
    if (local) return local;
  }
  return "—";
}

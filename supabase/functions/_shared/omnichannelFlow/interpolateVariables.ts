export function interpolateContactVariables(
  template: string,
  context: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    lastCustomerReply?: string | null;
  },
): string {
  const firstName =
    context.firstName?.trim() ||
    context.fullName?.trim()?.split(/\s+/)[0] ||
    "";
  const lastName = context.lastName?.trim() || "";
  const fullName = context.fullName?.trim() || firstName;
  const lastReply = context.lastCustomerReply?.trim() || "";

  return template
    .replace(/\{\{\s*contact\.first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*contact\.last_name\s*\}\}/gi, lastName)
    .replace(/\{\{\s*contact\.full_name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*last_customer_reply\s*\}\}/gi, lastReply);
}

export function delayToMs(duration: number, unit: string): number {
  const d = Number(duration);
  if (!Number.isFinite(d) || d <= 0) return 0;
  if (unit === "hours") return d * 60 * 60 * 1000;
  if (unit === "days") return d * 24 * 60 * 60 * 1000;
  return d * 60 * 1000;
}

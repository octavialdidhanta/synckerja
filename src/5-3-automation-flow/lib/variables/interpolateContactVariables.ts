type ContactVariableContext = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  lastCustomerReply?: string | null;
};

export function interpolateContactVariables(
  template: string,
  context: ContactVariableContext,
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

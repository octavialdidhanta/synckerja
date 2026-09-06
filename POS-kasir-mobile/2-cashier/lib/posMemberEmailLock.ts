import { shouldLockPosMemberName } from "./posMemberNameLock";
import { normalizeOptionalCustomerEmail } from "./isPosCustomerEmail";

/** Prefer CRM email when the member name is locked (personal CRM identity). */
export function resolvePosCheckoutEmailForCart(args: {
  crmEmail?: string | null;
  typedEmail?: string | null;
  lockCrmEmail: boolean;
}): string {
  const crm = normalizeOptionalCustomerEmail(args.crmEmail);
  const typed = normalizeOptionalCustomerEmail(args.typedEmail);
  if (args.lockCrmEmail && crm) return crm;
  return typed || crm;
}

/** After phone Check: sync field to CRM when locked or when field is empty. */
export function syncEmailFieldAfterMemberCheck(args: {
  crmEmail?: string | null;
  currentField: string;
  memberName?: string | null;
}): string {
  const crm = String(args.crmEmail ?? "").trim();
  if (!crm) return args.currentField;
  if (shouldLockPosMemberName(args.memberName) || !args.currentField.trim()) {
    return crm;
  }
  return args.currentField;
}

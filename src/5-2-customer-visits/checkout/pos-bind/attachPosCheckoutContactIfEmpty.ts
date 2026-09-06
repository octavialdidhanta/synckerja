import { normalizeCustomerEmail } from "@/5-2-customer-visits/lib/normalizeCustomerEmail";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";

/**
 * Fill-empty contact patches for POS ensure reuse paths.
 * Never overwrites an existing phone or email on the lead.
 */
export function attachPosCheckoutContactIfEmpty(args: {
  existingPhone?: string | null;
  existingEmail?: string | null;
  phoneKey?: string | null;
  emailKey?: string | null;
}): { phone_number?: string; email?: string } {
  const patch: { phone_number?: string; email?: string } = {};
  const hasPhone = Boolean(normalizeCustomerVisitPhone(args.existingPhone));
  const hasEmail = Boolean(normalizeCustomerEmail(args.existingEmail));
  if (!hasPhone && args.phoneKey) {
    patch.phone_number = args.phoneKey;
  }
  if (!hasEmail && args.emailKey) {
    patch.email = args.emailKey;
  }
  return patch;
}

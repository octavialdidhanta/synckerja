import { normalizeOptionalCustomerEmail } from "./isPosCustomerEmail";
import { posMemberPhoneLocalDigits } from "./posCashierCustomer";

/** Prefill digital-receipt fields on pay success from bill customer contacts. */
export function posPaySuccessContactPrefill(args: {
  email?: string | null;
  phone?: string | null;
}): { email: string; phoneLocal: string } {
  return {
    email: normalizeOptionalCustomerEmail(args.email),
    phoneLocal: posMemberPhoneLocalDigits(args.phone),
  };
}

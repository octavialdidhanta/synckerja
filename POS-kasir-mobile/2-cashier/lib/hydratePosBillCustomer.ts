import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { POS_CHECKOUT_WALK_IN_CLIENT } from "@/5-2-customer-visits/checkout/pos-bind";
import type { PosCashierCustomer } from "./posCashierCustomer";

export type HydratePosBillLead = {
  id: string;
  client: string;
  phone_number: string | null;
  email?: string | null;
};

/**
 * Resume an open bill: session text first, then CRM name if the HP matches a lead.
 * Without a phone this stays session-only (no lead insert).
 */
export function hydratePosBillCustomer(args: {
  sessionName: string;
  sessionPhone: string;
  lead: HydratePosBillLead | null;
}): PosCashierCustomer | null {
  const sessionName = args.sessionName.trim();
  const sessionPhone = args.sessionPhone.trim();
  if (!sessionName && !sessionPhone) return null;

  if (!sessionPhone) {
    return {
      leadId: null,
      name: sessionName || POS_CHECKOUT_WALK_IN_CLIENT,
      phone: "",
      email: "",
      boundByPhone: false,
    };
  }

  if (args.lead) {
    const crmPersonal = personalCustomerName(args.lead.client);
    const sessionPersonal = personalCustomerName(sessionName);
    return {
      leadId: args.lead.id,
      name:
        crmPersonal ??
        sessionPersonal ??
        (String(args.lead.client ?? "").trim() ||
          sessionName ||
          POS_CHECKOUT_WALK_IN_CLIENT),
      phone: args.lead.phone_number?.trim() || sessionPhone,
      email: String(args.lead.email ?? "").trim().toLowerCase(),
      boundByPhone: true,
    };
  }

  return {
    leadId: null,
    name: sessionName || POS_CHECKOUT_WALK_IN_CLIENT,
    phone: sessionPhone,
    email: "",
    boundByPhone: false,
  };
}

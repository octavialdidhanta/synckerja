import {
  isGenericCustomerName,
  personalCustomerName,
} from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { POS_CHECKOUT_WALK_IN_CLIENT } from "@/5-2-customer-visits/checkout/pos-bind";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";

export type PosCashierCustomer = {
  leadId: string | null;
  name: string;
  phone: string;
  boundByPhone: boolean;
};

export type PosLoyaltyIdentity = {
  id: string | null;
  name: string;
  phone: string;
};

/** Local digits after +62 for the Check input. */
export function posMemberPhoneLocalDigits(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("62") && digits.length > 2) return digits.slice(2);
  if (digits.startsWith("0") && digits.length > 1) return digits.slice(1);
  return digits;
}

export function posSessionOnlyGuest(name: string): PosCashierCustomer {
  const personal = personalCustomerName(name);
  return {
    leadId: null,
    name: personal ?? (name.trim() || POS_CHECKOUT_WALK_IN_CLIENT),
    phone: "",
    boundByPhone: false,
  };
}

export function isSessionOnlyGuest(customer: PosCashierCustomer | null | undefined): boolean {
  if (!customer) return false;
  return !customer.boundByPhone && !customer.leadId;
}

/**
 * CRM personal name wins over a cashier-typed name (e.g. Linda vs Octa Vialdi).
 */
export function posCashierCustomerFromLead(args: {
  leadId: string;
  client: string;
  phone: string;
  typedName?: string | null;
}): PosCashierCustomer {
  const crmPersonal = personalCustomerName(args.client);
  const typedPersonal = personalCustomerName(args.typedName);
  const phone =
    normalizeCustomerVisitPhone(args.phone) ?? String(args.phone ?? "").trim();
  return {
    leadId: args.leadId,
    name:
      crmPersonal ??
      typedPersonal ??
      (String(args.client ?? "").trim() || POS_CHECKOUT_WALK_IN_CLIENT),
    phone,
    boundByPhone: true,
  };
}

export function posCashierCustomerFromLoyalty(
  customer: PosLoyaltyIdentity,
): PosCashierCustomer {
  const phone = String(customer.phone ?? "").trim();
  const boundByPhone = Boolean(normalizeCustomerVisitPhone(phone) ?? (phone.length >= 8));
  return {
    leadId: customer.id,
    name: String(customer.name ?? "").trim() || POS_CHECKOUT_WALK_IN_CLIENT,
    phone,
    boundByPhone,
  };
}

export function posLoyaltyIdentityFromCashier(
  customer: PosCashierCustomer | null | undefined,
): PosLoyaltyIdentity | null {
  if (!customer) return null;
  const phone = customer.phone.trim();
  if (!phone) return null;
  return {
    id: customer.leadId,
    name: customer.name,
    phone,
  };
}

/** Label on the bill header button; generic Walk-in stays as "+ Add Customer". */
export function posCashierCustomerBillLabel(
  customer: PosCashierCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  const personal = personalCustomerName(customer.name);
  if (personal) return personal;
  if (customer.phone.trim()) return customer.name.trim() || null;
  if (isGenericCustomerName(customer.name)) return null;
  return customer.name.trim() || null;
}

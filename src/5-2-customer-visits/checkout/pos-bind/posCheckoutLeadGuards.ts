import {
  isGenericCustomerName,
  personalCustomerName,
} from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import {
  POS_CHECKOUT_PHONE_EXISTS,
  POS_CHECKOUT_WALK_IN_CLIENT,
  type PosCheckoutLeadRow,
} from "./posCheckoutLead.types";

export function isUsablePosCheckoutName(name: string | null | undefined): boolean {
  const personal = personalCustomerName(name);
  return Boolean(personal && personal.length >= 2);
}

export function resolvePosCheckoutInsertClient(requestedName: string | null | undefined): string {
  if (isUsablePosCheckoutName(requestedName)) {
    return personalCustomerName(requestedName) as string;
  }
  return POS_CHECKOUT_WALK_IN_CLIENT;
}

/** Only fill a generic/empty CRM name with a personal one. Never overwrite vialdi.id with Walk-in. */
export function resolvePosCheckoutClientPatch(
  oldClient: string | null | undefined,
  requestedName: string | null | undefined,
): string | null {
  if (!isUsablePosCheckoutName(requestedName)) return null;
  const next = personalCustomerName(requestedName);
  if (!next) return null;
  const old = String(oldClient ?? "").trim();
  if (old && !isGenericCustomerName(old)) return null;
  return next;
}

export function isAttributedPosCheckoutLead(
  lead: Pick<PosCheckoutLeadRow, "id" | "source" | "ticket_id">,
  enrolledLeadIds: ReadonlySet<string>,
): boolean {
  const source = (lead.source ?? "").trim();
  const ticket = (lead.ticket_id ?? "").trim().toUpperCase();
  if (source === "Lead Magnet") return true;
  if (ticket.startsWith("LEAD-")) return true;
  if (enrolledLeadIds.has(lead.id)) return true;
  return false;
}

export function isPosCheckoutPhoneExistsError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = String(error.message ?? "");
  return message.includes(POS_CHECKOUT_PHONE_EXISTS);
}

export function shouldRecordPosPaidCustomerVisit(boundByPhone: boolean): boolean {
  return boundByPhone === true;
}

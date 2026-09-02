import { personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";

/** Personal CRM names cannot be renamed from POS. Generic / empty names can be filled. */
export function shouldLockPosMemberName(name: string | null | undefined): boolean {
  return Boolean(personalCustomerName(name));
}

import { normalizeWaPhoneKey } from '@/5-3-whatsapp-template/utils/normalizeWaPhoneKey';

export function normalizeCustomerVisitPhone(input: string | null | undefined): string | null {
  return normalizeWaPhoneKey(input);
}

/** Exact-lookup variants for stored phone_number formats (no substring match). */
export function customerVisitPhoneLookupVariants(phoneKey: string): string[] {
  const variants = new Set<string>([phoneKey]);
  if (phoneKey.startsWith('62') && phoneKey.length > 2) {
    const rest = phoneKey.slice(2);
    variants.add(`0${rest}`);
    variants.add(`+${phoneKey}`);
    variants.add(rest);
  }
  return [...variants];
}

import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";

/** Phone identity key for Fase 3 merge clusters (same as POS visit normalize). */
export function normalizeMergePhoneKey(input: string | null | undefined): string | null {
  return normalizeCustomerVisitPhone(input);
}

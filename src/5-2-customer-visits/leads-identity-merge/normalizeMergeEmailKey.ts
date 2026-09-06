import { normalizeCustomerEmail } from "@/5-2-customer-visits/lib/normalizeCustomerEmail";

/**
 * Email identity key for Fase 3 merge clusters.
 * Falls back to lower(trim) for DB emails that fail strict validation,
 * matching SQL `lower(btrim(email))` clustering.
 */
export function normalizeMergeEmailKey(input: string | null | undefined): string | null {
  const strict = normalizeCustomerEmail(input);
  if (strict) return strict;
  const loose = String(input ?? "").trim().toLowerCase();
  return loose.length > 0 ? loose : null;
}

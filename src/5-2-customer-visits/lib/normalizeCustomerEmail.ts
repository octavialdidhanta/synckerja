/**
 * Normalize customer email for identity matching (POS bind + customers CLV).
 * Returns null when empty or not a plausible email.
 */
export function normalizeCustomerEmail(input: string | null | undefined): string | null {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/.test(normalized)) return null;
  return normalized;
}

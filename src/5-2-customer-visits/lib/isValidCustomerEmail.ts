/**
 * Shared customer email validation (POS Add Customer + digital receipt).
 * Rejects glued TLDs like gmail.comsss.
 */
export function isValidCustomerEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/.test(normalized)) return false;
  const domain = normalized.slice(normalized.indexOf("@") + 1);
  if (/(?:^|\.)(com|net|org|edu|gov|co|io|id|me|app|dev)[a-z]{2,}$/.test(domain)) {
    return false;
  }
  return true;
}

/** Empty string is allowed (optional field); non-empty must be valid. */
export function isOptionalCustomerEmailOk(email: string | null | undefined): boolean {
  const trimmed = String(email ?? "").trim();
  if (!trimmed) return true;
  return isValidCustomerEmail(trimmed);
}

export function normalizeOptionalCustomerEmail(
  email: string | null | undefined,
): string {
  const trimmed = String(email ?? "").trim().toLowerCase();
  if (!trimmed) return "";
  return isValidCustomerEmail(trimmed) ? trimmed : "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRecipientEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidRecipientEmail(value: string): boolean {
  const normalized = normalizeRecipientEmail(value);
  if (!normalized) return false;
  return EMAIL_PATTERN.test(normalized);
}

export function mapOperationalEmailRpcError(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes("email_duplicate")) return "email_duplicate";
  if (lower.includes("email_invalid")) return "email_invalid";
  if (lower.includes("email_required")) return "email_required";
  if (lower.includes("recipient_limit_reached")) return "recipient_limit_reached";
  if (lower.includes("forbidden")) return "forbidden";
  if (lower.includes("cannot_delete_verified")) return "cannot_delete_verified";
  if (lower.includes("token_expired")) return "token_expired";
  if (lower.includes("token_invalid")) return "token_invalid";
  return null;
}

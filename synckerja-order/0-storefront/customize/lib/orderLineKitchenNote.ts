export const ORDER_KITCHEN_NOTE_MAX = 200;

/** Plaintext kitchen note: strip tags, collapse space, cap 200 chars. */
export function sanitizeKitchenNote(raw: string | null | undefined): string | null {
  const stripped = String(raw ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ORDER_KITCHEN_NOTE_MAX);
  return stripped || null;
}

export function kitchenNoteFingerprint(raw: string | null | undefined): string {
  return sanitizeKitchenNote(raw) ?? "";
}

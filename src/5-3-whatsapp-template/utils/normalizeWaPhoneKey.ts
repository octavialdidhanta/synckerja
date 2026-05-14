/**
 * Canonical digit key for deduping WhatsApp recipients (Indonesia-friendly).
 * Aligns loosely with server-side matching in whatsapp-webhook (digits-only + 62 / leading 0).
 */
export function normalizeWaPhoneKey(input: string | null | undefined): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0") && d.length >= 10) d = `62${d.slice(1)}`;
  if (!d.startsWith("62") && d.startsWith("8") && d.length >= 9 && d.length <= 12) d = `62${d}`;
  if (d.length < 8 || d.length > 18) return null;
  return d;
}

export function pickDisplayPhone(raw: string | null | undefined, phoneKey: string): string {
  const t = String(raw ?? "").trim();
  if (t) return t;
  return phoneKey.startsWith("62") ? `+${phoneKey}` : phoneKey;
}

/** Pure helpers for whatsapp-phone-lookup (moved from the browser so the Meta token stays on the server). */

export const META_GRAPH_API_VERSION = "v21.0";

export const NOT_PHONE_NUMBER_ID =
  "ID ini bukan WhatsApp Phone Number ID (mungkin ID Instagram atau Page). Ambil Phone Number ID dari Meta: App → WhatsApp → API Setup.";
export const EMPTY_PROFILE =
  "Response dari Meta tidak berisi verified_name/display_phone_number. Pastikan ID adalah WhatsApp Phone Number ID dari App → WhatsApp → API Setup.";

export type PhoneProfile = { verified_name: string | null; display_phone_number: string | null };

export function normalizeDisplayPhone(raw: unknown): string | null {
  if (raw == null) return null;
  let num = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : null;
  if (num && /^\d+$/.test(num)) num = `+${num}`;
  return num || null;
}

/**
 * Interprets GET /{phone_number_id}. Throws NOT_PHONE_NUMBER_ID / EMPTY_PROFILE like the old browser code;
 * other Meta errors yield an empty profile (the old code did not block on them).
 */
export function parsePhoneProfile(ok: boolean, body: unknown): PhoneProfile {
  const data = (body ?? {}) as {
    verified_name?: unknown;
    display_phone_number?: unknown;
    error?: { message?: string };
  };
  if (!ok) {
    const msg = String(data.error?.message ?? "").toLowerCase();
    if (msg.includes("does not exist") || msg.includes("does not support") || msg.includes("missing permissions")) {
      throw new Error(NOT_PHONE_NUMBER_ID);
    }
    return { verified_name: null, display_phone_number: null };
  }
  const name = typeof data.verified_name === "string" ? data.verified_name.trim() || null : null;
  const num = normalizeDisplayPhone(data.display_phone_number);
  if (name == null && num == null) throw new Error(EMPTY_PROFILE);
  return { verified_name: name, display_phone_number: num };
}

/** Picks the display number for pnId from GET /{waba_id}/phone_numbers. */
export function pickDisplayPhoneFromList(ok: boolean, body: unknown, pnId: string): string | null {
  const data = (body ?? {}) as { data?: Array<{ id?: string; display_phone_number?: unknown }> };
  if (!ok || !Array.isArray(data.data)) return null;
  return normalizeDisplayPhone(data.data.find((p) => p.id === pnId)?.display_phone_number);
}

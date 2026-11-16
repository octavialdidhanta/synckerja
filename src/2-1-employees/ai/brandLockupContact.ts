/** Normalize brand website for Brand lockup (keep in sync with logo_save RPC). */
export function normalizeWebsiteUrl(value: string | null | undefined): string {
  const raw = String(value ?? "").replace(/\s+/g, "").trim().slice(0, 200);
  if (!raw) return "";
  if (/^(javascript|data):/i.test(raw) || /[<>"'`]/.test(raw)) return "";
  if (/^https?:\/\//i.test(raw)) return raw.slice(0, 200);
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/.*)?$/i.test(raw)) {
    return `https://${raw}`.slice(0, 200);
  }
  return "";
}

/** Normalize default contact (phone / wa.me / http URL). */
export function normalizeDefaultContact(value: string | null | undefined): string {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!raw) return "";
  if (/[<>"'`]/.test(raw) || /^(javascript|data):/i.test(raw)) return "";
  if (/^https?:\/\//i.test(raw) || /^wa\.me\//i.test(raw)) return raw;
  if (/^[+0-9][+0-9\s().-]{6,78}$/.test(raw)) return raw;
  return "";
}

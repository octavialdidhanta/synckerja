/** Normalisasi nomor telepon Indonesia untuk pencocokan lead. */

export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return "62" + digits.slice(1);
  }
  return digits;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  return s || null;
}

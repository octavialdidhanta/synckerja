/** Hanya angka (digit) dari input pengguna. */
export function idrDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Format string digit menjadi pemisah ribuan id-ID (titik), tanpa desimal.
 * Contoh: "1500000" -> "1.500.000"
 */
export function formatIdrThousandsFromDigits(digits: string): string {
  if (!digits) return "";
  const normalized = digits.replace(/^0+/, "") || "0";
  const n = Number(normalized);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

/** Parse nilai yang sudah diformat (atau mentah) ke number; NaN jika kosong/tak valid. */
export function parseIdrInputToNumber(formatted: string): number {
  const d = idrDigitsOnly(formatted);
  if (d === "") return NaN;
  const n = Number(d);
  return Number.isFinite(n) ? n : NaN;
}

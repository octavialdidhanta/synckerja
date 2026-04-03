const idInteger = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** Hanya digit (untuk parsing dari input terformat). */
export function stripToDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Tampilan dengan pemisah ribuan titik (id-ID), mis. 1500000 → "1.500.000". */
export function formatIdIntegerGrouping(digitsOnly: string): string {
  if (!digitsOnly) return "";
  const n = parseInt(digitsOnly, 10);
  if (!Number.isFinite(n)) return "";
  return idInteger.format(n);
}

/** Dari nilai tampilan atau mentah ke angka (untuk submit). */
export function parseGroupedIdInteger(s: string): number {
  const d = stripToDigits(s);
  if (!d) return NaN;
  return parseInt(d, 10);
}

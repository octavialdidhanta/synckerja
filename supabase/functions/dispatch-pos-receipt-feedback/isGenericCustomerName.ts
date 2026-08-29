/**
 * Keep in sync with src/pos-receipt-feedback/lib/isGenericCustomerName.ts
 */
export function isGenericCustomerName(name: string | null | undefined): boolean {
  const n = String(name ?? "").trim();
  if (!n) return true;
  const lower = n.toLowerCase();
  return lower === "walk-in" || lower === "walk in" || n === "—" || n === "-";
}

export function personalCustomerName(name: string | null | undefined): string | null {
  const n = String(name ?? "").trim();
  if (!n || isGenericCustomerName(n)) return null;
  return n;
}

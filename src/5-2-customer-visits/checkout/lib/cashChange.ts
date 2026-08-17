/** Cash tender is optional. Empty / invalid tendered does not block pay. */
export function parseTenderedAmount(value: string | null | undefined): number | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export function isTenderedEnough(total: number, tendered: number | null): boolean {
  if (tendered == null) return true;
  return tendered >= total;
}

export function changeDue(total: number, tendered: number | null): number | null {
  if (tendered == null || !Number.isFinite(tendered) || !Number.isFinite(total)) return null;
  if (tendered < total) return null;
  return tendered - total;
}

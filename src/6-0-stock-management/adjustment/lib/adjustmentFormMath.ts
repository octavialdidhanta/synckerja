export function toInventoryQty(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  // Ledger uses numeric(14,3) so we keep values stable at 3 decimals.
  return Math.round(n * 1000) / 1000;
}

export function calcDeltaQty(currentQty: number, actualQty: number): number {
  return toInventoryQty(actualQty) - toInventoryQty(currentQty);
}

export function isNonZeroQty(deltaQty: number): boolean {
  const d = toInventoryQty(deltaQty);
  return Math.abs(d) > 0;
}


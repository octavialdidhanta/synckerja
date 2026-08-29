import type { PosOutletBundle } from "./posBundleTypes";

/**
 * Resolve the unit price shown / added for the current bill sales type.
 * Missing sales-type price returns 0 so the tile stays disabled (no silent min fallback).
 */
export function resolvePosBundleUnitPrice(
  bundle: PosOutletBundle,
  salesTypeId: string | null | undefined,
): number {
  if (!bundle.useSalesTypePrices) {
    return bundle.bundlePrice > 0 ? bundle.bundlePrice : 0;
  }
  const id = String(salesTypeId ?? "").trim();
  if (!id) return 0;
  const match = bundle.salesTypePrices.find((row) => row.salesTypeId === id);
  if (!match) return 0;
  return match.price > 0 ? match.price : 0;
}

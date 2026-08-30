import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";

export type KitchenFireDeltaLine = {
  line: CustomerVisitCartLine;
  lineFingerprint: string;
  deltaQty: number;
  firedQty: number;
  cartQty: number;
};

function indexProductLines(cartLines: CustomerVisitCartLine[]) {
  return cartLines
    .filter((line) => !line.isCustomAmount && line.kind === "product")
    .map((line) => ({
      line,
      lineFingerprint: cartLineFingerprint(line),
    }));
}

/**
 * Lines not yet sent to KDS for this session (by fingerprint qty sum).
 * Split pay passes paid lines only as cartLines.
 */
export function computeKitchenFireDelta(
  cartLines: CustomerVisitCartLine[],
  firedQtyByFingerprint: Map<string, number>,
): KitchenFireDeltaLine[] {
  const deltas: KitchenFireDeltaLine[] = [];

  for (const { line, lineFingerprint } of indexProductLines(cartLines)) {
    const cartQty = Math.max(0, Math.round(Number(line.quantity) || 0));
    if (cartQty <= 0) continue;

    const firedQty = firedQtyByFingerprint.get(lineFingerprint) ?? 0;
    const deltaQty = cartQty - firedQty;
    if (deltaQty <= 0) continue;

    deltas.push({
      line,
      lineFingerprint,
      deltaQty,
      firedQty,
      cartQty,
    });
  }

  return deltas;
}

/** Build cart lines with delta quantities for ticket insert. */
export function kitchenFireDeltaToCartLines(
  deltas: KitchenFireDeltaLine[],
): CustomerVisitCartLine[] {
  return deltas.map(({ line, deltaQty }) => ({
    ...line,
    quantity: deltaQty,
  }));
}

import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

/**
 * Variant / catalog base unit price (before modifier extras and line discount).
 * Reconstructs from stored unitPrice so older cart snapshots still display.
 */
export function posBillLineBaseUnitPrice(
  line: Pick<CustomerVisitCartLine, "unitPrice" | "quantity" | "modifiers" | "lineDiscount">,
): number {
  const extras = (line.modifiers ?? []).reduce(
    (sum, m) => sum + Math.max(0, Math.round(Number(m.extraPrice) || 0)),
    0,
  );
  const qty = Math.max(1, Math.round(Number(line.quantity) || 1));
  const discountTotal = Math.max(0, Math.round(Number(line.lineDiscount?.amountRp) || 0));
  const discountPerUnit = Math.floor(discountTotal / qty);
  const unit = Math.max(0, Math.round(Number(line.unitPrice) || 0));
  return Math.max(0, unit - extras + discountPerUnit);
}

import { catalogItemLabel } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import type { PosKitchenTicketLineInsert } from "./posKitchenTypes";

function modifiersText(line: CustomerVisitCartLine): string | null {
  const parts: string[] = [];
  const variant = line.variantName?.trim();
  if (variant) parts.push(variant);
  for (const m of line.modifiers ?? []) {
    const name = m.name?.trim();
    if (name) parts.push(name);
  }
  const sales = line.lineSalesTypeLabel?.trim();
  if (sales) parts.push(sales);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/** Snapshot kitchen lines from cart (products only; skips custom amounts). */
export function buildKitchenTicketLinesFromCart(
  cartLines: CustomerVisitCartLine[],
): PosKitchenTicketLineInsert[] {
  const out: PosKitchenTicketLineInsert[] = [];
  let sort = 0;
  for (const line of cartLines) {
    if (line.isCustomAmount) continue;
    if (line.kind !== "product") continue;
    const qty = Math.max(0, Math.round(Number(line.quantity) || 0));
    if (qty <= 0) continue;
    out.push({
      line_fingerprint: cartLineFingerprint(line),
      display_name: catalogItemLabel(line),
      modifiers_text: modifiersText(line),
      quantity: qty,
      sort_index: sort++,
    });
  }
  return out;
}

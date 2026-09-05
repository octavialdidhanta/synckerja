import { catalogItemLabel } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { cartLineFingerprint } from "@/pos-mobile/2-cashier/lib/cartLineFingerprint";
import { sanitizeKitchenNote } from "@/synckerja-order/0-storefront/customize/lib/orderLineKitchenNote";
import type { PosKitchenTicketLineInsert } from "./posKitchenTypes";

function modifierLabel(name: string | undefined, quantity: number | undefined): string | null {
  const label = name?.trim();
  if (!label) return null;
  const qty = Math.max(1, Math.round(Number(quantity) || 1));
  return qty > 1 ? `${label} ×${qty}` : label;
}

/** KDS `modifiers_text` for a cart line (variant · mods · sales · Catatan). */
export function kitchenModifiersTextFromCartLine(
  line: CustomerVisitCartLine,
): string | null {
  const parts: string[] = [];
  const variant = line.variantName?.trim();
  if (variant) parts.push(variant);
  for (const m of line.modifiers ?? []) {
    const label = modifierLabel(m.name, m.quantity);
    if (label) parts.push(label);
  }
  const sales = line.lineSalesTypeLabel?.trim();
  if (sales) parts.push(sales);
  const note = sanitizeKitchenNote(line.kitchenNote);
  if (note) parts.push(`Catatan: ${note}`);
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
      modifiers_text: kitchenModifiersTextFromCartLine(line),
      quantity: qty,
      sort_index: sort++,
    });
  }
  return out;
}

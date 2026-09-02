import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { kitchenNoteFingerprint } from "@/synckerja-order/0-storefront/customize/lib/orderLineKitchenNote";

/** Fingerprint for merge identity of a customized (or plain) cart line. */
export function cartLineFingerprint(
  line: Pick<
    CustomerVisitCartLine,
    | "catalogId"
    | "isCustomAmount"
    | "lineKey"
    | "variantId"
    | "modifiers"
    | "lineDiscount"
    | "lineSalesTypeId"
    | "kitchenNote"
  >,
): string {
  if (line.isCustomAmount) {
    return line.lineKey || `custom:${line.catalogId}`;
  }
  const mods = (line.modifiers ?? [])
    .map((m) => `${m.optionId}:${Math.max(1, Math.round(Number(m.quantity) || 1))}`)
    .sort()
    .join(",");
  const note = kitchenNoteFingerprint(line.kitchenNote);
  const customized = Boolean(
    line.variantId ||
      mods ||
      line.lineDiscount?.id ||
      line.lineSalesTypeId ||
      note,
  );
  if (!customized) return `plain:${line.catalogId}`;
  return [
    line.catalogId,
    line.variantId ?? "",
    mods,
    line.lineDiscount?.id ?? "",
    line.lineSalesTypeId ?? "",
    note,
  ].join("|");
}

export function isPlainCartLine(line: CustomerVisitCartLine): boolean {
  return (
    !line.isCustomAmount &&
    !line.variantId &&
    !(line.modifiers && line.modifiers.length > 0) &&
    !line.lineDiscount &&
    !line.lineSalesTypeId &&
    !kitchenNoteFingerprint(line.kitchenNote)
  );
}

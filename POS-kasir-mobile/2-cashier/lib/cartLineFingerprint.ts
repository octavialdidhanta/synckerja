import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

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
  >,
): string {
  if (line.isCustomAmount) {
    return line.lineKey || `custom:${line.catalogId}`;
  }
  const mods = (line.modifiers ?? [])
    .map((m) => m.optionId)
    .sort()
    .join(",");
  const customized = Boolean(
    line.variantId ||
      mods ||
      line.lineDiscount?.id ||
      line.lineSalesTypeId,
  );
  if (!customized) return `plain:${line.catalogId}`;
  return [
    line.catalogId,
    line.variantId ?? "",
    mods,
    line.lineDiscount?.id ?? "",
    line.lineSalesTypeId ?? "",
  ].join("|");
}

export function isPlainCartLine(line: CustomerVisitCartLine): boolean {
  return (
    !line.isCustomAmount &&
    !line.variantId &&
    !(line.modifiers && line.modifiers.length > 0) &&
    !line.lineDiscount &&
    !line.lineSalesTypeId
  );
}
